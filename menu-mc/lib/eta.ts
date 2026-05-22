import { db } from "@/lib/db";

/**
 * Tunable parameters for the dynamic ETA algorithm.
 * All durations are in minutes.
 */
export const ETA = {
  /** How many orders the kitchen can prepare in parallel. Increase if you have a larger brigade. */
  KITCHEN_PARALLELISM: 2,
  /** Used when an OrderItem has no linked MenuItem (e.g. a manual line added by the admin). */
  DEFAULT_PREP_MINUTES: 10,
  /** Window used to measure recent order traffic for the surge multiplier. */
  RECENT_WINDOW_MINUTES: 10,
  /** Number of orders in the recent window allowed before surge starts. */
  SURGE_FREE_THRESHOLD: 5,
  /** Multiplier added per extra order over the threshold. */
  SURGE_PER_EXTRA: 0.05,
  /** Hard cap on the surge multiplier. */
  SURGE_MAX: 1.6
} as const;

type LineLike = { quantity: number; menuItem?: { prepTimeMinutes: number } | null };

/** Total prep work (minutes) for a list of order lines, falling back to a default per missing menu item. */
export function linesPrepMinutes(lines: LineLike[]): number {
  return lines.reduce((sum, it) => {
    const m = it.menuItem?.prepTimeMinutes ?? ETA.DEFAULT_PREP_MINUTES;
    return sum + m * it.quantity;
  }, 0);
}

/**
 * Traffic surge multiplier. The baseline is 1.0 (no surge); above the threshold we add a small
 * multiplier per recent order, capped at SURGE_MAX so runaway peaks still produce a sane ETA.
 */
export function surgeMultiplier(recentOrdersCount: number): number {
  if (recentOrdersCount <= ETA.SURGE_FREE_THRESHOLD) return 1.0;
  const raw = 1.0 + (recentOrdersCount - ETA.SURGE_FREE_THRESHOLD) * ETA.SURGE_PER_EXTRA;
  return Math.min(ETA.SURGE_MAX, raw);
}

async function recentOrdersCount(): Promise<number> {
  const since = new Date(Date.now() - ETA.RECENT_WINDOW_MINUTES * 60_000);
  return db.order.count({ where: { createdAt: { gte: since } } });
}

async function activeQueueMinutes(opts?: { excludeOrderId?: string; createdBefore?: Date }): Promise<number> {
  const queue = await db.order.findMany({
    where: {
      ...(opts?.excludeOrderId ? { id: { not: opts.excludeOrderId } } : {}),
      ...(opts?.createdBefore ? { createdAt: { lt: opts.createdBefore } } : {}),
      status: { in: ["NEW", "IN_PROGRESS"] }
    },
    include: { items: { include: { menuItem: true } } }
  });
  return queue.reduce((sum, o) => sum + linesPrepMinutes(o.items), 0);
}

/**
 * Estimate when a NEW order (not yet inserted) will be ready, taking into account:
 *   - the order's own prep work (sum of item.prepTimeMinutes × quantity),
 *   - the queue currently in the kitchen (NEW + IN_PROGRESS), divided by parallelism,
 *   - a traffic surge multiplier driven by recent order volume.
 */
export async function estimateReadyAtForNewOrder(opts: {
  ownPrepMinutes: number;
  anchor?: Date;
}): Promise<Date | null> {
  const anchor = opts.anchor ?? new Date();
  const queueAhead = await activeQueueMinutes();
  const queueWait = queueAhead / ETA.KITCHEN_PARALLELISM;
  const surge = surgeMultiplier(await recentOrdersCount());

  const totalMinutes = (queueWait + opts.ownPrepMinutes) * surge;
  if (totalMinutes <= 0) return null;
  return new Date(anchor.getTime() + totalMinutes * 60_000);
}

/**
 * Recompute the estimated-ready timestamp for an EXISTING order based on its current
 * queue position and recent traffic.
 *
 * Returns the new Date (or null if the order is already finished / has no work left).
 * Does not write to the database — the caller decides whether to persist.
 */
export async function recomputeEstimateForOrder(orderId: string): Promise<Date | null> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { menuItem: true } } }
  });
  if (!order) return null;
  if (order.status === "READY" || order.status === "COMPLETED" || order.status === "CANCELLED") {
    return order.readyAt ?? order.estimatedReadyAt;
  }

  const own = linesPrepMinutes(order.items);
  const surge = surgeMultiplier(await recentOrdersCount());

  if (order.status === "IN_PROGRESS" && order.startedAt) {
    if (own <= 0) return null;
    return new Date(order.startedAt.getTime() + own * surge * 60_000);
  }

  const aheadMinutes = await activeQueueMinutes({
    excludeOrderId: order.id,
    createdBefore: order.createdAt
  });
  const queueWait = aheadMinutes / ETA.KITCHEN_PARALLELISM;
  const total = (queueWait + own) * surge;
  if (total <= 0) return null;

  const anchor = new Date(Math.max(order.createdAt.getTime(), Date.now()));
  return new Date(anchor.getTime() + total * 60_000);
}

/**
 * Persist a freshly recomputed ETA for a single order. Convenience wrapper
 * around {@link recomputeEstimateForOrder}.
 */
export async function persistEstimateForOrder(orderId: string): Promise<Date | null> {
  const eta = await recomputeEstimateForOrder(orderId);
  await db.order.update({ where: { id: orderId }, data: { estimatedReadyAt: eta } });
  return eta;
}

/**
 * Cascade ETA recompute across every active order. Call this after events that shift the
 * queue for everyone — typically a status change (e.g. an order moving to READY frees a slot)
 * or a large bill edit. Cost is O(active²) per call; fine for typical restaurant volumes.
 */
export async function recomputeAllActiveEstimates(): Promise<void> {
  const active = await db.order.findMany({
    where: { status: { in: ["NEW", "IN_PROGRESS"] } },
    select: { id: true },
    orderBy: { createdAt: "asc" }
  });
  for (const o of active) {
    await persistEstimateForOrder(o.id);
  }
}
