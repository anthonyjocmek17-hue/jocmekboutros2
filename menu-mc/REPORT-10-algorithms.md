# 10.1 Algorithms

This chapter documents the main non-trivial algorithms in **Menu MC**. Where the code is short enough to read at a glance, the full implementation is included; longer pieces are presented as snippets with the remainder pointed to the appendix.

The application is largely glue between a Prisma database, a Next.js HTTP/RSC layer, and a React UI, so most of its complexity is concentrated in three pieces of logic:

| #  | Algorithm                              | File                                | Purpose |
|----|----------------------------------------|-------------------------------------|---------|
| A1 | Token-based menu search                | `app/api/chat/route.ts`             | Match a free-text question to menu items using normalized keyword tokens. |
| A2 | Context-aware recommendation           | `app/api/chat/route.ts`             | Suggest items based on the customer’s cart or table order. |
| A3 | Order totals recomputation             | `app/admin/orders/actions.ts`       | Re-derive `totalCents`, voucher discount, manual discount, and `finalTotalCents` after any bill edit. |
| A4 | Voucher discount computation           | `lib/discounts.ts`                  | Convert a `Voucher` row into a clamped discount value in cents. |
| A5 | Money parsing (auxiliary)              | `lib/money.ts`                      | Best-effort parsing of free-form price strings (e.g. `"$9.99"`, `"€ 12,50"`) into integer cents. |
| A6 | Dynamic order ETA (traffic-aware)      | `lib/eta.ts`                        | Predict each order’s ready time from per-item prep, the current kitchen queue, and a recent-traffic surge multiplier. |

For brevity, only **A2 (context-aware recommendation)** is shown in full as the *sample algorithm* in §10.1.1. The other algorithms are summarized below; their full source listings are included in the appendix.

---

### A1 — Token-based menu search (summary)

When the user asks a question that is **not** a recommendation request (e.g. *“what burgers do you have?”*), the chat route performs an offline keyword match over all available menu items.

The procedure is:

1. **Normalize and tokenize** the message (lowercase, strip punctuation, drop stop-words and tokens shorter than 3 characters, expand simple plural forms).
2. For each menu item, build a **word set** from its name, description, and category, again with simple plural normalization.
3. An item **matches** if any token (or its singular/plural variant) belongs to the item’s word set.

The key snippet is `tokenize` followed by `tokenMatchesItemWords`:

```230:270:menu-mc/app/api/chat/route.ts
function tokenize(q: string) {
  const raw = q
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => t.length >= 3)
    .filter((t) => !QUERY_STOPWORDS.has(t))
    .slice(0, 8);

  const expanded = new Set<string>();
  for (const t of raw) {
    expanded.add(t);
    if (t.length > 3 && t.endsWith("s")) expanded.add(t.slice(0, -1));
  }
  return [...expanded];
}

function itemWordSet(m: { name: string; description: string | null; category: { name: string } }): Set<string> {
  const blob = `${m.name} ${m.description ?? ""} ${m.category.name}`.toLowerCase();
  const words = blob.split(/[^a-z0-9]+/).filter(Boolean);
  const set = new Set<string>();
  for (const w of words) {
    set.add(w);
    if (w.length > 3 && w.endsWith("s")) set.add(w.slice(0, -1));
  }
  return set;
}

function tokenMatchesItemWords(tokens: string[], itemWords: Set<string>): boolean {
  return tokens.some((t) => {
    const variants = new Set<string>([t]);
    if (t.length > 3 && t.endsWith("s")) variants.add(t.slice(0, -1));
    if (t.length > 2 && !t.endsWith("s")) variants.add(`${t}s`);
    for (const v of variants) {
      if (itemWords.has(v)) return true;
    }
    return false;
  });
}
```

**Complexity.** With *N* menu items, *T* user tokens, and *W* average words per item, the per-request cost is *O(N · W)* to build word sets plus *O(N · T)* to match — both linear in the menu size, which is small (tens of rows).

---

### A3 — Order totals recomputation (summary)

Whenever an admin edits an order line, voucher code, manual discount, or final-price override, `recomputeOrderTotals` re-derives **all** monetary fields from scratch to avoid drift:

```132:161:menu-mc/app/admin/orders/actions.ts
async function recomputeOrderTotals(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true }
  });
  if (!order) return;

  const totalCents = order.items.reduce((sum, it) => sum + parsePriceToCents(it.price) * it.quantity, 0);

  const voucherCode = order.voucherCode;
  const voucher = voucherCode ? await db.voucher.findUnique({ where: { code: voucherCode } }) : null;
  const voucherDiscountCents = computeVoucherDiscountCents(totalCents, voucher);
  const remainingAfterVoucher = Math.max(0, totalCents - voucherDiscountCents);
  const manualDiscountCents = clampManualDiscountCents(remainingAfterVoucher, order.manualDiscountCents ?? 0);
  const computedFinalCents = Math.max(0, totalCents - voucherDiscountCents - manualDiscountCents);
  const finalTotalCents =
    order.finalTotalOverrideCents != null
      ? Math.max(0, order.finalTotalOverrideCents)
      : computedFinalCents;

  await db.order.update({
    where: { id: orderId },
    data: {
      totalCents,
      voucherDiscountCents,
      manualDiscountCents,
      finalTotalCents
    }
  });
}
```

The order of operations — **subtotal → voucher → clamp manual discount to remaining → optional override** — guarantees that no negative totals are persisted and that an explicit `finalTotalOverrideCents` always wins.

---

### A4 — Voucher discount computation (summary)

`computeVoucherDiscountCents` (in `lib/discounts.ts`) maps a `Voucher` row to an integer cent value, enforcing every constraint (active, not expired, under max-uses) and clamping the result to the order subtotal so a voucher can never exceed the bill:

```3:17:menu-mc/lib/discounts.ts
export function computeVoucherDiscountCents(totalCents: number, voucher: Voucher | null): number {
  if (!voucher) return 0;
  if (!voucher.isActive) return 0;
  if (voucher.expiresAt && voucher.expiresAt.getTime() < Date.now()) return 0;
  if (voucher.maxUses !== null && voucher.maxUses !== undefined && voucher.usesCount >= voucher.maxUses) return 0;

  if (voucher.type === "AMOUNT") {
    const amt = voucher.amountCents ?? 0;
    return Math.max(0, Math.min(totalCents, amt));
  }

  const pct = voucher.percent ?? 0;
  const p = Math.max(0, Math.min(100, pct));
  return Math.max(0, Math.min(totalCents, Math.round((totalCents * p) / 100)));
}
```

The full source for A1, A3, A4, and A5 is reproduced in **Appendix A — Algorithm Listings**.

---

## 10.1.1 Sample algorithm — *Context-aware menu recommendation*

This sample shows how Menu MC turns the customer’s **cart and active table order** into a list of personalized, deterministic menu suggestions, without calling an external AI service.

### Goal

Given:
- the live menu (`MenuItem`s with their `Category`),
- the customer’s context (their cart from the client, plus, for `TABLE` users, the items of their latest active order),
- and a request limit (default 10),

return a short, ordered list of *available* menu items that:
1. **Belong to the same categories** the customer is already ordering from (e.g. if they ordered a *Burger*, suggest other *Burgers* / *Sandwiches*),
2. **Are not already in their cart/order** (no duplicate suggestions),
3. **Fall back to drinks/coffee** if the category-based pool is too small, so the customer always gets a meaningful pairing suggestion.

### Pseudocode

```
ALGORITHM SuggestFromCustomerContext(menu, customerLines, limit)
    if customerLines is empty:
        return []                                          // handled by caller

    matched ← MatchOrderedMenuItems(menu, customerLines)   // fuzzy name match
    matchedCategories ← { m.categoryId : m ∈ matched }
    orderedIds        ← { m.id         : m ∈ matched }
    orderedNames      ← { lowercase(l.name) : l ∈ customerLines }

    pool ← items m ∈ menu such that
              m.categoryId ∈ matchedCategories
              AND m.id ∉ orderedIds
              AND m.name does not collide (substring) with any name in orderedNames

    if |pool| < 4:
        drinkCategories ← categories whose name matches /coffee|beverage|drink|cold/
        extras ← items m ∈ menu in drinkCategories
                    that are not already in pool and not in orderedIds
        pool ← pool ⧺ extras

    return first `limit` items of pool
```

### Implementation

The full implementation lives in `app/api/chat/route.ts` and is short enough to include in the chapter. It relies on a small helper, `matchOrderedMenuItems`, to perform the fuzzy name match between cart lines and `MenuItem`s.

```51:65:menu-mc/app/api/chat/route.ts
function matchOrderedMenuItems(all: MenuWithCat[], lines: CartLineIn[]): MenuWithCat[] {
  const hits: MenuWithCat[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const q = line.name.toLowerCase().trim();
    if (!q) continue;
    const hit =
      all.find((m) => m.name.toLowerCase() === q) ||
      all.find((m) => m.name.toLowerCase().includes(q) || q.includes(m.name.toLowerCase()));
    if (hit && !seen.has(hit.id)) {
      seen.add(hit.id);
      hits.push(hit);
    }
  }
  return hits;
}
```

```81:105:menu-mc/app/api/chat/route.ts
function suggestFromCustomerContext(all: MenuWithCat[], lines: CartLineIn[], limit = 10): MenuWithCat[] {
  if (lines.length === 0) return [];
  const matched = matchOrderedMenuItems(all, lines);
  const catIds = new Set(matched.map((m) => m.categoryId));
  const orderedIds = new Set(matched.map((m) => m.id));
  const orderedNames = new Set(lines.map((l) => l.name.toLowerCase()));

  let pool = all.filter(
    (m) =>
      catIds.has(m.categoryId) &&
      !orderedIds.has(m.id) &&
      ![...orderedNames].some((on) => m.name.toLowerCase() === on || m.name.toLowerCase().includes(on) || on.includes(m.name.toLowerCase()))
  );

  if (pool.length < 4) {
    const drinky = (n: string) => /coffee|beverage|drink|cold/i.test(n);
    const drinkCats = new Set(all.filter((m) => drinky(m.category.name)).map((m) => m.categoryId));
    const extras = all.filter(
      (m) => drinkCats.has(m.categoryId) && !orderedIds.has(m.id) && !pool.some((p) => p.id === m.id)
    );
    pool = [...pool, ...extras];
  }

  return pool.slice(0, limit);
}
```

### Step-by-step walkthrough

1. **Early exit.** If the merged customer context is empty (no cart, no active table order), the function returns `[]`. The caller, in this case, falls back to `generalMenuPicks`, which returns one item per category as generic *starter ideas*.
2. **Resolve cart lines to menu items.** `matchOrderedMenuItems` performs a layered fuzzy match per cart line:
   - exact lowercase equality first,
   - then a bidirectional `includes` test (so *“cheese burger”* matches *“Cheeseburger”* and vice versa).
   The first hit wins and is de-duplicated via the `seen` set.
3. **Project to category and identity sets.** From the matched items, build `catIds` (the categories the customer is already shopping in) and `orderedIds` (items to never re-suggest). `orderedNames` is also built directly from the raw cart, so even items that did not match a `MenuItem` still suppress near-duplicates.
4. **Filter the pool.** Walk the menu once and keep items that are:
   - **in one of the customer’s categories** (`catIds.has(m.categoryId)`),
   - **not already ordered by id** (`!orderedIds.has(m.id)`),
   - **not a near-name duplicate** of anything in the cart, using the same bidirectional `includes` test as step 2.
5. **Drink top-up.** When the pool has fewer than four candidates (e.g. the customer ordered something niche), the function looks up *drink-like* categories by a regular expression (`/coffee|beverage|drink|cold/`) and appends those items, skipping anything already picked. This guarantees the assistant can almost always suggest a beverage pairing.
6. **Limit.** The first `limit` items are returned in menu order (`sortOrder, name`), preserving an editorially curated sequence.

### Why this design

- **Deterministic.** Identical inputs produce identical output. This matters because the same function powers the **AI-free fallback path**: when no `OPENAI_API_KEY` is configured, the chat route formats this list directly into the user-facing reply (see `fallbackReplyWithoutAi`).
- **Grounded.** Suggestions can only come from rows already in the database with `isAvailable = true`, so the assistant cannot recommend a dish that isn’t on the menu. When an AI key *is* configured, the same list is passed to the model as `MENU CONTEXT` and the system prompt forbids inventing dishes.
- **Robust to incomplete data.** Cart lines that fail to fuzzy-match still influence the result via `orderedNames`, preventing duplicate suggestions even when the menu has been edited.
- **Inclusive of empty contexts.** A separate sibling, `generalMenuPicks`, ensures the empty-cart case still gets a curated cross-section of the menu rather than an unhelpful “no suggestions” message.

### Complexity analysis

Let *N* = number of available menu items, *L* = number of customer lines, and *D* = number of distinct categories.

| Step                              | Cost            |
|-----------------------------------|-----------------|
| `matchOrderedMenuItems`           | *O(L · N)* worst-case (linear scan per line) |
| Build `catIds`, `orderedIds`, `orderedNames` | *O(L)*    |
| Pool filter                       | *O(N · L)* (string `includes` per item per name) |
| Drink top-up                      | *O(N)*          |
| Slice to `limit`                  | *O(limit)*      |

Total: **O(N · L)**, which is dominated by the catalog scan. With realistic values (*N* ≈ 50–200 items, *L* ≤ 80 cart lines validated by Zod), the function runs in well under a millisecond and easily fits within the surrounding `findMany` request.

### Integration in the request handler

The recommendation function is selected at request time by an *intent detector* (`isRecommendationIntent`, A2-adjacent) and then woven into the eventual reply path:

```314:333:menu-mc/app/api/chat/route.ts
    const suggestedMenuItems = recommendation
      ? customerLines.length > 0
        ? suggestFromCustomerContext(allMenuTyped, customerLines, 10)
        : generalMenuPicks(allMenuTyped, 10)
      : [];
    const suggestionRows = toMenuRows(suggestedMenuItems);

    const tokens = tokenize(message);

    let menuItems: typeof allMenu;

    if (recommendation && suggestedMenuItems.length > 0) {
      menuItems = suggestedMenuItems;
    } else if (recommendation && customerLines.length > 0) {
      menuItems = [];
    } else if (tokens.length === 0) {
      menuItems = await db.menuItem.findMany({ ...baseQuery, take: 40 });
    } else {
      menuItems = allMenuTyped.filter((m) => tokenMatchesItemWords(tokens, itemWordSet(m))).slice(0, 40);
    }
```

When an AI key is present, `menuItems` becomes the `MENU CONTEXT` block of the model prompt; when one is not, it is rendered directly as bullet points by the offline fallback. Either way, the final list of dishes the user sees is exactly the list this algorithm produced.

---

## 10.1.2 Dynamic order ETA — *traffic-aware ready-time estimation*

The estimated time shown to a guest on `/order` (and stored in `Order.estimatedReadyAt`) is **not** a static sum of prep times. As traffic and the kitchen queue grow, the estimate grows with them. The algorithm lives in `lib/eta.ts` and is invoked from every place that creates or mutates an order.

### Goal

Given:
- the new (or existing) order’s **own prep work** — `Σ (item.prepTimeMinutes × quantity)` over its lines,
- the **kitchen queue ahead of it** — every other order whose status is `NEW` or `IN_PROGRESS` (and, for an existing order, only those created earlier than it),
- the **kitchen parallelism** *K* (how many orders the brigade can prepare concurrently),
- and the **recent traffic** — number of orders created in the last *W* minutes,

produce a `Date` representing when the order is realistically expected to be ready, or `null` if there is no remaining work.

### Inputs and tunable constants

All knobs live on a single exported `ETA` constant in `lib/eta.ts`, so operators can adjust them without touching the algorithm:

```5:21:menu-mc/lib/eta.ts
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
```

### Pseudocode

```
ALGORITHM EstimateReadyAt(order, now)
    own         ← Σ (item.prepMinutes × item.quantity)               // own work
    aheadMins   ← Σ (queueOrder.ownPrepMinutes)                      // queue ahead
                  for queueOrder ∈ activeOrders, queueOrder ≠ order,
                  queueOrder.createdAt < order.createdAt
    queueWait   ← aheadMins / KITCHEN_PARALLELISM                    // parallel slots

    recent      ← count orders created in the last RECENT_WINDOW_MINUTES
    surge       ← Surge(recent)                                      // 1.0 … SURGE_MAX

    if order is IN_PROGRESS and order.startedAt is set:
        return order.startedAt + own × surge × 60s                   // already cooking
    else:
        anchor  ← max(now, order.createdAt)                          // can't go backwards
        return anchor + (queueWait + own) × surge × 60s

ALGORITHM Surge(recent)
    if recent ≤ SURGE_FREE_THRESHOLD:
        return 1.0
    return min(SURGE_MAX, 1.0 + (recent − SURGE_FREE_THRESHOLD) × SURGE_PER_EXTRA)
```

### Implementation snippets

The two pure functions — own prep work and the surge multiplier — fit comfortably in the chapter:

```24:43:menu-mc/lib/eta.ts
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
```

The async helper that combines them with a database read is:

```64:80:menu-mc/lib/eta.ts
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
```

The recompute path for an existing order is structurally identical but anchors at `startedAt` once the kitchen has begun cooking; the full source of `recomputeEstimateForOrder` is in **Appendix A**.

### Numerical example

Tunables at default values: *K* = 2, *W* = 10 minutes, threshold = 5, step = +0.05, cap = 1.6×.

A new order is placed with three lines:

| Item        | Prep (min) | Qty | Subtotal (min) |
|-------------|-----------:|----:|---------------:|
| Burger      | 12         | 1   | 12             |
| Salad       | 6          | 1   | 6              |
| Cappuccino  | 3          | 2   | 6              |
| **Own prep**|            |     | **24**         |

The kitchen currently holds **3 active orders** with a combined own prep of **40 minutes**. **8 orders** were created in the last 10 minutes.

```
queueWait = 40 / 2                     = 20 min
surge     = 1.0 + (8 − 5) × 0.05       = 1.15×
total     = (20 + 24) × 1.15           ≈ 50.6 min
estimate  = now + 50.6 min
```

A quiet moment with the **same order** but only 1 active order ahead (12 min) and 4 recent orders (no surge) yields:

```
queueWait = 12 / 2          = 6 min
surge     = 1.0
total     = (6 + 24) × 1.0  = 30 min
estimate  = now + 30 min
```

Same order, **two different ETAs** — exactly the desired behavior.

### Where it’s called

- **Order creation** (`app/api/orders/route.ts`, `app/api/waiter/orders/route.ts`) replaces the previous naive sum with `estimateReadyAtForNewOrder({ ownPrepMinutes })`.
- **Status changes** (`app/api/kitchen/orders/route.ts` PATCH and `app/admin/orders/actions.ts` `updateOrder`) call `recomputeAllActiveEstimates()` so that, when one order moves to `READY` and frees a slot, every queued order’s ETA shifts forward immediately.
- **Bill edits** (`recomputeOrderTotals` in `app/admin/orders/actions.ts`) call `persistEstimateForOrder(orderId)` so adding/removing/changing lines re-derives the affected order’s ETA against the current queue.

### Properties

- **Traffic-aware.** Recent volume in `RECENT_WINDOW_MINUTES` directly multiplies the estimate (`SURGE_FREE_THRESHOLD` … `SURGE_MAX`).
- **Queue-aware.** Adding a long-prep order to the queue lengthens every following order’s ETA (after the next cascade).
- **Parallelism-aware.** A larger brigade is modelled by raising `KITCHEN_PARALLELISM`; queue wait shrinks accordingly.
- **Anchored to reality once cooking starts.** While `IN_PROGRESS`, the estimate uses `startedAt + own × surge`, so it stops drifting with new arrivals after preparation has begun.
- **Robust to missing data.** Manual order lines without a `MenuItem` link fall back to `DEFAULT_PREP_MINUTES`.
- **Non-decreasing.** The anchor is `max(now, createdAt)`, so the ETA never displays a time in the past.

### Complexity

Let *N* = number of active orders, *L̄* = average lines per order.

| Step                                 | Cost |
|--------------------------------------|------|
| `linesPrepMinutes` for one order     | *O(L̄)* |
| `activeQueueMinutes`                 | *O(N · L̄)* (one Prisma fetch + reduce) |
| `recentOrdersCount`                  | *O(1)* (indexed `count`) |
| `recomputeEstimateForOrder`          | *O(N · L̄)* |
| `recomputeAllActiveEstimates`        | *O(N² · L̄)* |

For typical restaurant volumes (*N* ≈ tens of orders) the cascade completes in milliseconds; if it ever became a hot path it could be batched into a single SQL aggregate.

### Limitations and forward work

- The model assumes **homogeneous parallelism**; in reality a busy hot line might bottleneck on grill stations regardless of how many cold-prep slots are free. A natural extension is to attribute prep minutes to *station* and aggregate per station.
- **Surge** uses a flat coefficient over a 10-minute window. A weighted exponential decay (more recent orders count more) would respond faster to bursts.
- The cascade is currently triggered from the request that caused it; a small **outbox / job queue** would let the recompute run asynchronously and survive crashes.
