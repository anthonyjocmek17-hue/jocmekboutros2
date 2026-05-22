import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCentsUSD } from "@/lib/money";
import { createVoucher, deleteVoucher, toggleVoucherActive } from "./actions";

export default async function AdminVouchersPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const vouchers = await db.voucher.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <div className="ui-card p-6">
        <h1 className="menu-title text-xs font-semibold text-accent">Vouchers</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-slate-200/70">Create voucher codes and toggle them on/off.</p>
      </div>

      <div className="ui-card p-6">
        <div className="text-sm font-semibold">Create voucher</div>
        <form action={createVoucher} className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="block md:col-span-2">
            <span className="text-xs text-black/60 dark:text-slate-200/70">Code</span>
            <input
              name="code"
              className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
              placeholder="SAVE10"
              required
            />
          </label>
          <label className="block">
            <span className="text-xs text-black/60 dark:text-slate-200/70">Type</span>
            <select
              name="type"
              className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
            >
              <option value="PERCENT">Percent</option>
              <option value="AMOUNT">Amount</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-black/60 dark:text-slate-200/70">Value</span>
            <input
              name="percent"
              className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
              placeholder="10 (percent)"
            />
            <input
              name="amountDollars"
              className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
              placeholder="5.00 (dollars)"
            />
          </label>
          <div className="md:col-span-4">
            <button className="ui-btn ui-btn-accent px-4 py-2 text-sm font-semibold shadow-menu">Create</button>
          </div>
        </form>
      </div>

      <div className="ui-card p-6">
        <div className="text-sm font-semibold">Existing</div>
        <ul className="mt-3 divide-y divide-black/10 dark:divide-white/10">
          {vouchers.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <div className="text-sm font-semibold">{v.code}</div>
                <div className="text-xs text-black/60 dark:text-slate-200/70">
                  {v.type === "PERCENT" ? `${v.percent ?? 0}% off` : `${formatCentsUSD(v.amountCents ?? 0)} off`} ·{" "}
                  {v.isActive ? "active" : "inactive"} · uses {v.usesCount}
                </div>
              </div>
              <div className="flex gap-2">
                <form
                  action={async () => {
                    "use server";
                    await toggleVoucherActive(v.code);
                  }}
                >
                  <button className="ui-btn px-3 py-2 text-xs dark:bg-slate-900/50 dark:hover:bg-slate-900/70">
                    {v.isActive ? "Disable" : "Enable"}
                  </button>
                </form>
                <form
                  action={async () => {
                    "use server";
                    await deleteVoucher(v.code);
                  }}
                >
                  <button className="rounded-xl border border-red-500/30 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                    Delete
                  </button>
                </form>
              </div>
            </li>
          ))}
          {vouchers.length === 0 ? (
            <li className="py-6 text-sm text-black/60 dark:text-slate-200/70">No vouchers yet.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

