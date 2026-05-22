import { unstable_noStore as noStore } from "next/cache";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCentsAsDollarInput, formatCentsUSD, parsePriceToCents } from "@/lib/money";
import { AdminOrdersScrollRestore } from "./AdminOrdersScrollRestore";
import {
  addOrderLine,
  deleteOrder,
  deleteOrderLine,
  saveBillDiscounts,
  saveBillFinal,
  updateOrder,
  updateOrderLine
} from "./actions";

function lineSubtotalCents(price: string | null, qty: number) {
  return parsePriceToCents(price) * qty;
}

function billLinesSubtotalCents(items: { price: string | null; quantity: number }[]) {
  return items.reduce((sum, it) => sum + lineSubtotalCents(it.price, it.quantity), 0);
}

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  noStore();
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const orders = await db.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { table: true, user: true, items: true }
  });

  return (
    <div className="space-y-6">
      <AdminOrdersScrollRestore />
      <div className="ui-card p-6">
        <h1 className="menu-title text-xs font-semibold text-accent">Orders</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-slate-200/70">
          Discounts and final price use the forms below each bill header (outside the line-items table) so saves work
          reliably. After each save you return to the same bill.
        </p>
      </div>

      <div className="ui-card overflow-x-auto p-4">
        {orders.length === 0 ? (
          <p className="p-6 text-sm text-black/60 dark:text-slate-200/70">No orders yet.</p>
        ) : null}

        {orders.map((o, idx) => {
          const billRootId = `bill-${o.id}`;
          const metaFormId = `bill-${o.id}-meta`;
          const discountFormId = `bill-${o.id}-discounts`;
          const finalFormId = `bill-${o.id}-final`;
          const linesSubtotal = billLinesSubtotalCents(o.items);
          const computedAutoFinal = Math.max(
            0,
            o.totalCents - (o.voucherDiscountCents ?? 0) - (o.manualDiscountCents ?? 0)
          );

          return (
            <div key={o.id} id={billRootId} className="scroll-mt-28 border-b border-black/10 pb-8 last:border-b-0">
              {idx > 0 ? (
                <div className="mx-1 mb-8 h-0 border-t-2 border-dashed border-black/20" aria-hidden role="presentation" />
              ) : null}

              <div className="rounded-2xl bg-black/[0.03] p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-sm font-semibold">
                      {o.table.label} · <span className="text-black/60">{o.status}</span>
                    </div>
                    <div className="mt-1 text-xs text-black/60">
                      Ordered: {o.createdAt.toLocaleString()}
                      {" · "}
                      Authorized by: {o.user.email}
                    </div>
                    <div className="mt-1 text-xs text-black/50">
                      ETA: {o.estimatedReadyAt ? o.estimatedReadyAt.toLocaleTimeString() : "—"}
                      {" · "}
                      Subtotal (lines): {formatCentsUSD(linesSubtotal)}
                      {" · "}
                      {o.isPaid ? `Paid (${o.paidAt ? o.paidAt.toLocaleString() : "—"})` : "Unpaid"}
                      {" · "}
                      {o.items.reduce((s, i) => s + i.quantity, 0)} items
                    </div>
                  </div>

                  <form
                    id={metaFormId}
                    action={updateOrder}
                    className="grid w-full max-w-3xl gap-2 sm:grid-cols-2 lg:grid-cols-3"
                  >
                    <input type="hidden" name="orderId" value={o.id} />
                    <label className="block sm:col-span-1">
                      <span className="text-[11px] text-black/60">Status</span>
                      <select
                        name="status"
                        defaultValue={o.status}
                        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs"
                      >
                        <option value="NEW">NEW</option>
                        <option value="IN_PROGRESS">IN_PROGRESS</option>
                        <option value="READY">READY</option>
                        <option value="COMPLETED">COMPLETED</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                    </label>
                    <label className="block sm:col-span-2 lg:col-span-2">
                      <span className="text-[11px] text-black/60">Note</span>
                      <input
                        name="note"
                        defaultValue={o.note ?? ""}
                        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs"
                        placeholder="(optional)"
                      />
                    </label>
                    <label className="block sm:col-span-2 lg:col-span-3">
                      <span className="text-[11px] text-black/60">Paid</span>
                      <select
                        name="isPaid"
                        defaultValue={o.isPaid ? "true" : "false"}
                        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs"
                      >
                        <option value="false">Unpaid</option>
                        <option value="true">Paid</option>
                      </select>
                    </label>
                    <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3">
                      <button type="submit" className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white">
                        Save order
                      </button>
                      <button
                        type="submit"
                        formAction={deleteOrder}
                        className="rounded-xl border border-red-500/30 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
                      >
                        Delete order
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <form
                  id={discountFormId}
                  action={saveBillDiscounts}
                  className="scroll-mt-28 rounded-2xl border border-black/10 bg-white p-4 shadow-sm"
                >
                  <input type="hidden" name="orderId" value={o.id} />
                  <div className="text-xs font-semibold text-black/50">Discounts</div>
                  <p className="mt-1 text-[11px] text-black/45">
                    Voucher and manual discount. Submit with <strong className="font-semibold">Save discounts</strong>.
                  </p>
                  {o.finalTotalOverrideCents != null ? (
                    <p className="mt-2 text-[11px] font-medium text-amber-900/90">
                      Custom final is on: manual discount still updates the bill record; charged total stays your custom
                      final until you clear it under Final price.
                    </p>
                  ) : null}
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-[11px] text-black/60">Voucher code</span>
                      <input
                        name="voucherCode"
                        defaultValue={o.voucherCode ?? ""}
                        autoComplete="off"
                        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs"
                        placeholder="SAVE10"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-black/60">Manual discount ($)</span>
                      <input
                        name="manualDiscount"
                        defaultValue={formatCentsAsDollarInput(o.manualDiscountCents ?? 0)}
                        inputMode="decimal"
                        autoComplete="off"
                        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs"
                        placeholder="0.00"
                      />
                    </label>
                  </div>
                  <button type="submit" className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white">
                    Save discounts
                  </button>
                </form>

                <form
                  id={finalFormId}
                  action={saveBillFinal}
                  className="scroll-mt-28 rounded-2xl border border-black/10 bg-white p-4 shadow-sm"
                >
                  <input type="hidden" name="orderId" value={o.id} />
                  <div className="text-xs font-semibold text-black/50">Final price</div>
                  <p className="mt-1 text-[11px] text-black/45">
                    Charged total only. Clear the field and save to use the automatic total again.
                  </p>
                  <label className="mt-3 block max-w-xs">
                    <span className="text-[11px] text-black/60">Final price ($)</span>
                    <input
                      name="finalPriceOverride"
                      defaultValue={
                        o.finalTotalOverrideCents != null
                          ? formatCentsAsDollarInput(o.finalTotalOverrideCents)
                          : ""
                      }
                      inputMode="decimal"
                      autoComplete="off"
                      className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs"
                      placeholder={`Auto (${formatCentsUSD(computedAutoFinal)})`}
                    />
                  </label>
                  <button type="submit" className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white">
                    Save final price
                  </button>
                </form>
              </div>

              <div id={`bill-${o.id}-lines`} className="scroll-mt-28 mt-4">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-black/50">Line items</div>
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-black/10 text-left text-[11px] font-semibold uppercase tracking-wide text-black/50">
                      <th className="w-10 px-3 py-2 font-semibold">#</th>
                      <th className="px-3 py-2 font-semibold">Name</th>
                      <th className="w-28 px-3 py-2 font-semibold">Price</th>
                      <th className="w-20 px-3 py-2 font-semibold">Qty</th>
                      <th className="w-28 px-3 py-2 font-semibold">Subtotal</th>
                      <th className="w-40 px-3 py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.items.map((it, lineIdx) => {
                      const formId = `line-${o.id}-${it.id}`;
                      const sub = lineSubtotalCents(it.price, it.quantity);
                      return (
                        <tr id={`bill-line-${it.id}`} key={it.id} className="border-t border-black/5">
                          <td className="px-3 py-2 align-middle text-xs text-black/50">
                            {lineIdx + 1}
                            <form id={formId} action={updateOrderLine} className="hidden" aria-hidden>
                              <input type="hidden" name="orderId" value={o.id} />
                              <input type="hidden" name="itemId" value={it.id} />
                            </form>
                          </td>
                          <td className="px-3 py-2 align-middle">
                            <input
                              form={formId}
                              name="name"
                              defaultValue={it.name}
                              className="w-full rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs"
                              required
                            />
                          </td>
                          <td className="px-3 py-2 align-middle">
                            <input
                              form={formId}
                              name="price"
                              defaultValue={it.price ?? ""}
                              className="w-full rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs"
                              placeholder="$9.99"
                            />
                          </td>
                          <td className="px-3 py-2 align-middle">
                            <input
                              form={formId}
                              name="quantity"
                              type="number"
                              min={1}
                              max={99}
                              defaultValue={it.quantity}
                              className="w-full rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs"
                              required
                            />
                          </td>
                          <td className="px-3 py-2 align-middle text-xs tabular-nums text-black/70">
                            {formatCentsUSD(sub)}
                          </td>
                          <td className="px-3 py-2 align-middle">
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="submit"
                                form={formId}
                                className="rounded-lg bg-blue-600 px-2 py-1.5 text-[11px] font-semibold text-white"
                              >
                                Save line
                              </button>
                              <button
                                type="submit"
                                form={formId}
                                formAction={deleteOrderLine}
                                className="rounded-lg border border-red-500/30 bg-red-50 px-2 py-1.5 text-[11px] font-semibold text-red-700"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    <tr id={`bill-${o.id}-add`} className="border-t border-black/10 bg-black/[0.02]">
                      <td className="px-3 py-2 align-middle text-xs font-semibold text-black/50">+</td>
                      <td colSpan={5} className="px-3 py-2 align-middle">
                        <form action={addOrderLine} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                          <input type="hidden" name="orderId" value={o.id} />
                          <label className="block min-w-[140px] flex-1">
                            <span className="text-[11px] text-black/60">New line name</span>
                            <input
                              name="name"
                              className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs"
                              required
                            />
                          </label>
                          <label className="block w-full min-w-[100px] sm:w-28">
                            <span className="text-[11px] text-black/60">Price</span>
                            <input
                              name="price"
                              className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs"
                              placeholder="$0.00"
                            />
                          </label>
                          <label className="block w-full min-w-[72px] sm:w-20">
                            <span className="text-[11px] text-black/60">Qty</span>
                            <input
                              name="quantity"
                              type="number"
                              min={1}
                              max={99}
                              defaultValue={1}
                              className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs"
                            />
                          </label>
                          <button
                            type="submit"
                            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white sm:shrink-0"
                          >
                            Add line
                          </button>
                        </form>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div id={`bill-${o.id}-totals`} className="scroll-mt-28 mt-4 rounded-2xl border border-black/10 bg-black/[0.04] p-4">
                <div className="text-xs font-semibold text-black/60">Bill totals</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-xl border border-black/10 bg-white px-3 py-2">
                    <div className="text-[11px] text-black/50">Subtotal (from lines)</div>
                    <div className="mt-1 text-sm font-semibold tabular-nums">{formatCentsUSD(linesSubtotal)}</div>
                  </div>
                  <div className="rounded-xl border border-black/10 bg-white px-3 py-2 sm:col-span-2 lg:col-span-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-black/50">Stored total / final</span>
                      {o.finalTotalOverrideCents != null ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                          Custom final
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-sm font-semibold tabular-nums">
                      {formatCentsUSD(o.totalCents)}
                      {(o.voucherDiscountCents ?? 0) > 0 || (o.manualDiscountCents ?? 0) > 0 ? (
                        <span className="block text-xs font-normal text-black/55">
                          −{formatCentsUSD((o.voucherDiscountCents ?? 0) + (o.manualDiscountCents ?? 0))} →{" "}
                          <span className="font-semibold text-black">{formatCentsUSD(o.finalTotalCents)}</span>
                          {o.finalTotalOverrideCents != null ? (
                            <span className="mt-1 block text-[10px] text-amber-900/80">
                              Charged amount is the custom final; discounts above are kept for the record.
                            </span>
                          ) : null}
                        </span>
                      ) : o.finalTotalOverrideCents != null ? (
                        <span className="block text-xs font-normal text-black/55">
                          Charged:{" "}
                          <span className="font-semibold text-black">{formatCentsUSD(o.finalTotalCents)}</span>
                        </span>
                      ) : (
                        <span className="block text-xs font-normal text-black/45">No discounts applied yet.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
