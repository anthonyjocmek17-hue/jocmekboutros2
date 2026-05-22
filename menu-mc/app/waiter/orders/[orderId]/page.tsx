import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCentsUSD } from "@/lib/money";
import { setOrderDelivered, setOrderPaid } from "../../actions";

export const dynamic = "force-dynamic";

export default async function WaiterOrderDetailPage({
  params
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const role = (session as any).role as string;
  if (role !== "WAITER" && role !== "ADMIN") redirect("/");

  const { orderId } = await params;

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { table: true, user: true, items: true }
  });
  if (!order) redirect("/waiter");

  const isReadyToDeliver = order.status === "READY" && !order.deliveredAt;

  return (
    <div className="space-y-6">
      <div
        className={[
          "ui-card flex flex-wrap items-center justify-between gap-3 p-6",
          isReadyToDeliver
            ? "border-emerald-500/50 bg-emerald-50/70 dark:border-emerald-400/45 dark:bg-emerald-950/35"
            : ""
        ].join(" ")}
      >
        <div>
          <div className="menu-title text-xs font-semibold text-accent">Deliver order</div>
          {isReadyToDeliver ? (
            <div className="mt-2 rounded-full border border-emerald-500/40 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900 dark:border-emerald-400/35 dark:bg-emerald-900/50 dark:text-emerald-100">
              Ready — deliver to table
            </div>
          ) : null}
          <div className="mt-2 text-sm font-semibold">
            {order.table.label} · <span className="text-black/60 dark:text-slate-200/70">{order.status}</span>
          </div>
          <div className="mt-1 text-xs text-black/60 dark:text-slate-200/70">
            Created: {order.createdAt.toLocaleString()}
            {" · "}
            By: {order.user.email}
          </div>
          {order.note ? <div className="mt-2 rounded-xl bg-black/5 p-2 text-xs text-black/70">Note: {order.note}</div> : null}
        </div>
        <Link href="/waiter" className="ui-btn px-4 py-2">
          Back to waiter
        </Link>
      </div>

      <div
        className={[
          "ui-card-strong p-6",
          isReadyToDeliver
            ? "waiter-ready-glow border-emerald-500/70 bg-emerald-50/80 dark:border-emerald-400/55 dark:bg-emerald-950/40"
            : ""
        ].join(" ")}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold">Items</div>
          <div className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold">
            {order.items.reduce((s, i) => s + i.quantity, 0)} items
          </div>
        </div>

        <ul className="mt-3 divide-y divide-black/10">
          {order.items.map((it) => (
            <li key={it.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                <span className="font-medium">{it.quantity}×</span> {it.name}
              </span>
              {it.price ? <span className="text-black/60">{it.price}</span> : null}
            </li>
          ))}
          {order.items.length === 0 ? <li className="py-4 text-sm text-black/60">No items.</li> : null}
        </ul>

        <div className="mt-4 flex flex-wrap gap-2">
          <div className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold">
            Total: {formatCentsUSD(order.totalCents)}
          </div>
          {(order.voucherDiscountCents || order.manualDiscountCents) ? (
            <div className="rounded-full border border-blue-600/20 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900">
              Final: {formatCentsUSD(order.finalTotalCents)}
            </div>
          ) : null}
          <div
            className={[
              "rounded-full px-3 py-1 text-xs font-semibold",
              order.isPaid ? "bg-emerald-100 text-emerald-900" : "bg-blue-50 text-blue-900"
            ].join(" ")}
          >
            {order.isPaid ? "Paid" : "Unpaid"}
          </div>
          <div
            className={[
              "rounded-full px-3 py-1 text-xs font-semibold",
              order.deliveredAt ? "bg-emerald-100 text-emerald-900" : "bg-black/5 text-black/70"
            ].join(" ")}
          >
            {order.deliveredAt ? "Delivered" : "Not delivered"}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <form action={setOrderPaid}>
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="isPaid" value={order.isPaid ? "false" : "true"} />
            <input type="hidden" name="returnTo" value={`/waiter/orders/${order.id}`} />
            <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white">
              Mark {order.isPaid ? "unpaid" : "paid"}
            </button>
          </form>

          <form action={setOrderDelivered}>
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="delivered" value={order.deliveredAt ? "false" : "true"} />
            <input type="hidden" name="returnTo" value={`/waiter/orders/${order.id}`} />
            <button
              type="submit"
              className={[
                "rounded-xl px-4 py-2 text-xs font-semibold",
                order.deliveredAt ? "border border-black/10 bg-white text-black hover:bg-black/5" : "bg-emerald-600 text-white"
              ].join(" ")}
            >
              {order.deliveredAt ? "Undo delivered" : "Mark delivered"}
            </button>
          </form>
        </div>

        {order.deliveredAt ? (
          <div className="mt-3 text-xs text-black/60 dark:text-slate-200/70">
            Delivered at: {order.deliveredAt.toLocaleString()}
          </div>
        ) : null}
      </div>
    </div>
  );
}

