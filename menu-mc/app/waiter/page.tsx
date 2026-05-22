import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCentsUSD } from "@/lib/money";
import { setOrderDelivered, setOrderPaid } from "./actions";
import { ManualOrderForm } from "./ui/ManualOrderForm";

export const dynamic = "force-dynamic";

function OrderRow({
  o
}: {
  o: any;
}) {
  const isDone = o.status === "READY" || o.status === "COMPLETED";
  const isDelivered = !!o.deliveredAt;
  const isReadyToDeliver = o.status === "READY" && !isDelivered;
  return (
    <li
      key={o.id}
      className={[
        "rounded-2xl border shadow-soft",
        "bg-white/80 backdrop-blur",
        "border-black/10",
        "dark:border-white/10 dark:bg-slate-900/70 dark:backdrop-blur-0",
        isReadyToDeliver
          ? "waiter-ready-glow border-emerald-500/70 bg-emerald-50/95 dark:border-emerald-400/55 dark:bg-emerald-950/45"
          : "",
        !isReadyToDeliver && isDelivered ? "border-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-950/25" : "",
        !isReadyToDeliver && !isDelivered && isDone ? "bg-emerald-50/30 dark:bg-emerald-950/15" : ""
      ].join(" ")}
    >
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div>
            <div className="text-sm font-semibold">
              {o.table.label} · <span className="text-black/60 dark:text-slate-200/70">{o.status}</span>
            </div>
            <div className="mt-1 text-xs text-black/60 dark:text-slate-200/70">
              {o.createdAt.toLocaleString()} · by {o.user.email}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isReadyToDeliver ? (
              <span className="rounded-full border border-emerald-500/40 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900 dark:border-emerald-400/35 dark:bg-emerald-900/50 dark:text-emerald-100">
                Ready — pick up
              </span>
            ) : null}
            <span className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-xs font-semibold dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-100/90">
              {o.items.reduce((s: number, it: any) => s + it.quantity, 0)} items
            </span>
            <span className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-xs font-semibold dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-100/90">
              Total: {formatCentsUSD(o.totalCents)}
            </span>
            {(o.voucherDiscountCents || o.manualDiscountCents) ? (
              <span className="rounded-full border border-blue-600/20 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900 dark:border-sky-400/20 dark:bg-sky-950/40 dark:text-sky-100">
                Final: {formatCentsUSD(o.finalTotalCents)}
              </span>
            ) : null}
            <span
              className={[
                "rounded-full px-3 py-1 text-xs font-semibold",
                o.isPaid
                  ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                  : "bg-blue-50 text-blue-900 dark:bg-sky-950/40 dark:text-sky-100"
              ].join(" ")}
            >
              {o.isPaid ? "Paid" : "Unpaid"}
            </span>
            <span
              className={[
                "rounded-full px-3 py-1 text-xs font-semibold",
                isDelivered
                  ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                  : "bg-black/5 text-black/70 dark:bg-white/10 dark:text-slate-100/80"
              ].join(" ")}
            >
              {isDelivered ? "Delivered" : "Not delivered"}
            </span>

            <span className="rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-xs font-semibold hover:bg-black/5 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-100/90 dark:hover:bg-slate-900/70">
              Open
            </span>
          </div>
        </summary>

        <div className="border-t border-black/10 px-4 py-4 dark:border-white/10">
          {o.note ? (
            <div className="mb-3 rounded-xl bg-black/5 p-2 text-xs text-black/70 dark:bg-white/10 dark:text-slate-100/80">
              Note: {o.note}
            </div>
          ) : null}

          <div className="text-xs font-semibold text-black/60 dark:text-slate-200/70">Items</div>
          <ul className="mt-2 divide-y divide-black/10 rounded-xl border border-black/10 bg-white/80 dark:divide-white/10 dark:border-white/10 dark:bg-slate-900/50">
            {o.items.map((it: any) => (
              <li key={it.id} className="flex items-center justify-between px-3 py-2 text-sm dark:text-slate-100/90">
                <span>
                  <span className="font-medium">{it.quantity}×</span> {it.name}
                </span>
                {it.price ? <span className="text-black/60 dark:text-slate-200/70">{it.price}</span> : null}
              </li>
            ))}
            {o.items.length === 0 ? (
              <li className="px-3 py-3 text-sm text-black/60 dark:text-slate-200/70">No items.</li>
            ) : null}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href={`/waiter/orders/${o.id}`}
              target="_blank"
              rel="noreferrer"
              className="ui-btn dark:bg-slate-900/50 dark:hover:bg-slate-900/70"
            >
              Open in new tab
            </Link>

            <form action={setOrderPaid}>
              <input type="hidden" name="orderId" value={o.id} />
              <input type="hidden" name="isPaid" value={o.isPaid ? "false" : "true"} />
              <input type="hidden" name="returnTo" value="/waiter" />
              <button type="submit" className="ui-btn ui-btn-blue px-3 py-2">
                Mark {o.isPaid ? "unpaid" : "paid"}
              </button>
            </form>

            <form action={setOrderDelivered}>
              <input type="hidden" name="orderId" value={o.id} />
              <input type="hidden" name="delivered" value={isDelivered ? "false" : "true"} />
              <input type="hidden" name="returnTo" value="/waiter" />
              <button
                type="submit"
                className={[
                  "ui-btn px-3 py-2",
                  isDelivered
                    ? "dark:bg-slate-900/50 dark:hover:bg-slate-900/70"
                    : "ui-btn-green border-transparent text-white"
                ].join(" ")}
              >
                {isDelivered ? "Undo delivered" : "Mark delivered"}
              </button>
            </form>
          </div>

          <div className="mt-3 text-xs text-black/50 dark:text-slate-200/60">
            {o.isPaid && o.paidAt ? <>Paid at: {o.paidAt.toLocaleString()}</> : null}
            {o.isPaid && o.paidAt && isDelivered ? " · " : null}
            {isDelivered ? <>Delivered at: {o.deliveredAt.toLocaleString()}</> : null}
          </div>
        </div>
      </details>
    </li>
  );
}

export default async function WaiterPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session as any).role as string;
  const isAdmin = role === "ADMIN";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday-based week
  const startOfNextWeek = new Date(startOfWeek);
  startOfNextWeek.setDate(startOfNextWeek.getDate() + 7);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [todayPaid, weekPaid, monthPaid, unpaidAgg] = isAdmin
    ? await Promise.all([
        db.order.aggregate({
          where: { isPaid: true, paidAt: { gte: startOfToday, lt: startOfTomorrow } },
          _sum: { finalTotalCents: true },
          _count: { _all: true }
        }),
        db.order.aggregate({
          where: { isPaid: true, paidAt: { gte: startOfWeek, lt: startOfNextWeek } },
          _sum: { finalTotalCents: true },
          _count: { _all: true }
        }),
        db.order.aggregate({
          where: { isPaid: true, paidAt: { gte: startOfMonth, lt: startOfNextMonth } },
          _sum: { finalTotalCents: true },
          _count: { _all: true }
        }),
        db.order.aggregate({
          where: { isPaid: false },
          _sum: { finalTotalCents: true },
          _count: { _all: true }
        })
      ])
    : [
        { _sum: { finalTotalCents: 0 }, _count: { _all: 0 } } as any,
        { _sum: { finalTotalCents: 0 }, _count: { _all: 0 } } as any,
        { _sum: { finalTotalCents: 0 }, _count: { _all: 0 } } as any,
        { _sum: { finalTotalCents: 0 }, _count: { _all: 0 } } as any
      ];

  const [tables, menuItems] = await Promise.all([
    db.table.findMany({ orderBy: { label: "asc" } }),
    db.menuItem.findMany({ where: { isAvailable: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] })
  ]);

  const orders = await db.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { table: true, user: true, items: true }
  });

  return (
    <div className="space-y-6">
      <div className="ui-card p-6">
        <h1 className="menu-title text-xs font-semibold text-accent">Waiter</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-slate-200/70">Mark orders as paid/unpaid and track income.</p>
      </div>

      {isAdmin ? (
        <div className="grid gap-3 md:grid-cols-4">
          <div className="ui-card p-5">
            <div className="text-xs text-black/60 dark:text-slate-200/70">Today (paid)</div>
            <div className="mt-1 text-2xl font-semibold">{formatCentsUSD(todayPaid._sum.finalTotalCents ?? 0)}</div>
            <div className="mt-1 text-xs text-black/50 dark:text-slate-200/60">{todayPaid._count._all} orders</div>
          </div>
          <div className="ui-card p-5">
            <div className="text-xs text-black/60 dark:text-slate-200/70">This week (paid)</div>
            <div className="mt-1 text-2xl font-semibold">{formatCentsUSD(weekPaid._sum.finalTotalCents ?? 0)}</div>
            <div className="mt-1 text-xs text-black/50 dark:text-slate-200/60">{weekPaid._count._all} orders</div>
          </div>
          <div className="ui-card p-5">
            <div className="text-xs text-black/60 dark:text-slate-200/70">This month (paid)</div>
            <div className="mt-1 text-2xl font-semibold">{formatCentsUSD(monthPaid._sum.finalTotalCents ?? 0)}</div>
            <div className="mt-1 text-xs text-black/50 dark:text-slate-200/60">{monthPaid._count._all} orders</div>
          </div>
          <div className="ui-card p-5">
            <div className="text-xs text-black/60 dark:text-slate-200/70">Unpaid outstanding</div>
            <div className="mt-1 text-2xl font-semibold">{formatCentsUSD(unpaidAgg._sum.finalTotalCents ?? 0)}</div>
            <div className="mt-1 text-xs text-black/50 dark:text-slate-200/60">{unpaidAgg._count._all} orders</div>
          </div>
        </div>
      ) : null}

      <div className="ui-card p-6">
        <div className="text-sm font-semibold">Manual order</div>
        <p className="mt-1 text-sm text-black/60 dark:text-slate-200/70">Create an order for a table (waiter/admin).</p>
        <div className="mt-4">
          <ManualOrderForm
            tables={tables.map((t) => ({ id: t.id, label: t.label }))}
            menuItems={menuItems.map((m) => ({
              id: m.id,
              name: m.name,
              price: m.price,
              isOutOfStock: m.isOutOfStock
            }))}
          />
        </div>
      </div>

      {(() => {
        const ready = orders.filter((o) => o.status === "READY");
        const notDelivered = orders.filter((o) => !o.deliveredAt);
        const delivered = orders.filter((o) => !!o.deliveredAt);
        const paid = orders.filter((o) => o.isPaid);

        const sections: { title: string; subtitle: string; data: any[] }[] = [
          { title: "Ready", subtitle: "Orders that are ready to be delivered to tables.", data: ready },
          { title: "Not delivered", subtitle: "Anything not marked delivered yet (includes active/ready).", data: notDelivered },
          { title: "Delivered", subtitle: "Orders marked delivered.", data: delivered },
          { title: "Paid", subtitle: "Orders marked paid.", data: paid }
        ];

        return (
          <div className="grid gap-4">
            {sections.map((s) => (
              <section key={s.title} className="ui-card p-6">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{s.title}</div>
                    <div className="mt-1 text-xs font-medium text-black/60 dark:text-slate-100/80">{s.subtitle}</div>
                  </div>
                  <div className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold dark:bg-white/10">
                    {s.data.length} orders
                  </div>
                </div>

                <ul className="mt-4 grid gap-3">
                  {s.data.map((o) => (
                    <OrderRow key={o.id} o={o} />
                  ))}
                  {s.data.length === 0 ? <li className="text-sm text-black/60">No orders in this section.</li> : null}
                </ul>
              </section>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

