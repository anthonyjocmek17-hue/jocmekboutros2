"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/useCart";

export default function CartPage() {
  const { data: session } = useSession();
  const cart = useCart();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [voucherCode, setVoucherCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  const canCheckout = (session as any)?.role === "TABLE";

  const summary = useMemo(() => {
    return {
      totalItems: cart.totalItems,
      lines: cart.state.lines
    };
  }, [cart.state.lines, cart.totalItems]);

  return (
    <div className="space-y-6">
      <div className="ui-card p-6">
        <h1 className="menu-title text-xs font-semibold text-accent">Cart</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-slate-200/70">
          {canCheckout ? "You’re logged in as a table. Checkout sends the order to the kitchen screen." : "Log in as a table to checkout."}
        </p>
      </div>

      <div className="ui-card p-6">
        {summary.lines.length === 0 ? (
          <div className="text-sm text-black/60 dark:text-slate-200/70">
            Your cart is empty. <Link className="underline" href="/">Go to menu</Link>.
          </div>
        ) : (
          <div className="space-y-4">
            <ul className="divide-y divide-black/10 dark:divide-white/10">
              {summary.lines.map((l) => (
                <li key={l.menuItemId} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <div className="text-sm font-medium">{l.name}</div>
                    {l.price ? <div className="text-xs text-black/50 dark:text-slate-200/60">{l.price}</div> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="ui-btn h-8 w-8 rounded-full p-0 dark:bg-slate-900/50 dark:hover:bg-slate-900/70"
                      onClick={() => cart.setQuantity(l.menuItemId, l.quantity - 1)}
                    >
                      -
                    </button>
                    <div className="w-8 text-center text-sm">{l.quantity}</div>
                    <button
                      className="ui-btn h-8 w-8 rounded-full p-0 dark:bg-slate-900/50 dark:hover:bg-slate-900/70"
                      onClick={() => cart.setQuantity(l.menuItemId, l.quantity + 1)}
                    >
                      +
                    </button>
                    <button
                      className="ui-btn px-3 py-2 dark:bg-slate-900/50 dark:hover:bg-slate-900/70"
                      onClick={() => cart.removeLine(l.menuItemId)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <label className="block">
              <span className="text-xs text-black/60 dark:text-slate-200/70">Note to kitchen (optional)</span>
              <textarea
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-accent/30 focus:ring dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g., no onions"
              />
            </label>

            <label className="block">
              <span className="text-xs text-black/60 dark:text-slate-200/70">Voucher (optional)</span>
              <input
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-accent/30 focus:ring dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value)}
                placeholder="Enter voucher code"
              />
            </label>

            {error ? <div className="rounded-xl border border-red-500/30 bg-red-50 p-2 text-xs text-red-700">{error}</div> : null}
            {successId ? (
              <div className="rounded-xl border border-emerald-600/20 bg-emerald-50 p-2 text-xs text-emerald-900">
                Order sent. Order id: <span className="font-mono">{successId}</span>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                className="ui-btn px-4 py-2 text-sm dark:bg-slate-900/50 dark:hover:bg-slate-900/70"
                onClick={() => cart.clear()}
              >
                Clear cart
              </button>
              <button
                disabled={!canCheckout || submitting || summary.totalItems === 0}
                className="ui-btn ui-btn-accent px-4 py-2 text-sm font-semibold shadow-menu disabled:opacity-60"
                onClick={async () => {
                  setError(null);
                  setSuccessId(null);
                  if (!canCheckout) {
                    setError("You must be logged in as a table to checkout.");
                    return;
                  }
                  setSubmitting(true);
                  try {
                    const res = await fetch("/api/orders", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ note, voucherCode, lines: summary.lines })
                    });
                    if (!res.ok) {
                      let msg = "";
                      try {
                        const j = (await res.json()) as any;
                        msg = j?.error || j?.message || "";
                      } catch {
                        msg = await res.text();
                      }
                      throw new Error(msg || `Checkout failed (${res.status})`);
                    }
                    const data = (await res.json()) as { id: string };
                    setSuccessId(data.id);
                    cart.clear();
                    setNote("");
                    setVoucherCode("");
                    router.push("/order");
                  } catch (e: any) {
                    setError(e?.message || "Checkout failed");
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                {submitting ? "Sending..." : "Checkout → Kitchen"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

