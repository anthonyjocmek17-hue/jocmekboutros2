"use client";

import { useMemo, useState } from "react";

type TableOption = { id: string; label: string };
type MenuItemOption = { id: string; name: string; price: string | null; isOutOfStock: boolean };

type Line = { menuItemId: string; quantity: number };

/** Prefer the menu row named "Item" so waiter manual orders do not default to e.g. "4 Cheese" (first by name/sort). */
function defaultWaiterOrderMenuItemId(menuItems: MenuItemOption[]): string {
  const item = menuItems.find((m) => m.name.trim().toLowerCase() === "item");
  if (item) return item.id;
  return menuItems[0]?.id ?? "";
}

export function ManualOrderForm({ tables, menuItems }: { tables: TableOption[]; menuItems: MenuItemOption[] }) {
  const [tableId, setTableId] = useState(tables[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [voucherCode, setVoucherCode] = useState("");
  const [manualDiscount, setManualDiscount] = useState("0.00");
  const [lines, setLines] = useState<Line[]>([
    { menuItemId: defaultWaiterOrderMenuItemId(menuItems), quantity: 1 }
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  const byId = useMemo(() => new Map(menuItems.map((m) => [m.id, m])), [menuItems]);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="text-xs text-black/60 dark:text-slate-200/70">Table</span>
          <select
            className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-blue-500/30 focus:ring dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
            value={tableId}
            onChange={(e) => setTableId(e.target.value)}
          >
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-black/60 dark:text-slate-200/70">Note (optional)</span>
          <input
            className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-blue-500/30 focus:ring dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g., customer paying cash"
          />
        </label>
        <label className="block">
          <span className="text-xs text-black/60 dark:text-slate-200/70">Voucher (optional)</span>
          <input
            className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-blue-500/30 focus:ring dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
            value={voucherCode}
            onChange={(e) => setVoucherCode(e.target.value)}
            placeholder="e.g., SAVE10"
          />
        </label>
        <label className="block">
          <span className="text-xs text-black/60 dark:text-slate-200/70">Manual discount ($)</span>
          <input
            className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-blue-500/30 focus:ring dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
            value={manualDiscount}
            onChange={(e) => setManualDiscount(e.target.value)}
            placeholder="0.00"
          />
        </label>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-black/60 dark:text-slate-200/70">Items</div>
        {lines.map((l, idx) => {
          const item = byId.get(l.menuItemId);
          return (
            <div key={idx} className="grid gap-2 md:grid-cols-[1fr_120px_90px]">
              <select
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-blue-500/30 focus:ring dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
                value={l.menuItemId}
                onChange={(e) => {
                  const menuItemId = e.target.value;
                  setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, menuItemId } : x)));
                }}
              >
                {menuItems.map((m) => (
                  <option key={m.id} value={m.id} disabled={m.isOutOfStock}>
                    {m.name}
                    {m.isOutOfStock ? " (out)" : ""}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min={1}
                max={99}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-blue-500/30 focus:ring dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
                value={l.quantity}
                onChange={(e) => {
                  const quantity = Math.max(1, Math.min(99, Math.trunc(Number(e.target.value || "1"))));
                  setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity } : x)));
                }}
              />

              <button
                className="ui-btn px-3 py-2 text-xs dark:bg-slate-900/50 dark:hover:bg-slate-900/70"
                onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                disabled={lines.length <= 1}
              >
                Remove
              </button>

              {item?.isOutOfStock ? (
                <div className="md:col-span-3 rounded-xl border border-blue-600/20 bg-blue-50 p-2 text-xs text-blue-900">
                  This item is out of stock.
                </div>
              ) : null}
            </div>
          );
        })}

        <button
          className="ui-btn px-3 py-2 text-xs dark:bg-slate-900/50 dark:hover:bg-slate-900/70"
          onClick={() =>
            setLines((prev) => [...prev, { menuItemId: defaultWaiterOrderMenuItemId(menuItems), quantity: 1 }])
          }
        >
          + Add item
        </button>
      </div>

      {error ? <div className="rounded-xl border border-red-500/30 bg-red-50 p-2 text-xs text-red-700">{error}</div> : null}
      {successId ? (
        <div className="rounded-xl border border-emerald-600/20 bg-emerald-50 p-2 text-xs text-emerald-900">
          Order created: <span className="font-mono">{successId}</span>
        </div>
      ) : null}

      <button
        disabled={submitting || !tableId || lines.some((l) => !l.menuItemId)}
        className="ui-btn ui-btn-blue cart-blue-pulse px-4 py-2 text-sm font-semibold disabled:opacity-60"
        onClick={async () => {
          setSubmitting(true);
          setError(null);
          setSuccessId(null);
          try {
            const res = await fetch("/api/waiter/orders", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ tableId, note, voucherCode, manualDiscount, lines })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "Failed to create order");
            setSuccessId(data.id);
            setNote("");
            setVoucherCode("");
            setManualDiscount("0.00");
            setLines([{ menuItemId: defaultWaiterOrderMenuItemId(menuItems), quantity: 1 }]);
          } catch (e: any) {
            setError(e?.message || "Failed to create order");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {submitting ? "Creating..." : "Create order"}
      </button>
    </div>
  );
}

