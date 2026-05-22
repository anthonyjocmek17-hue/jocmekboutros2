"use client";

import { useEffect, useMemo, useState } from "react";

type KitchenOrder = {
  id: string;
  status: "NEW" | "IN_PROGRESS" | "READY" | "COMPLETED" | "CANCELLED";
  note: string | null;
  createdAt: string;
  table: { label: string };
  items: { id: string; name: string; price: string | null; quantity: number }[];
};

export function KitchenClient() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    const res = await fetch("/api/kitchen/orders", { cache: "no-store" });
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    const data = (await res.json()) as { orders: KitchenOrder[] };
    setOrders(data.orders);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await refresh();
      } finally {
        setLoading(false);
      }
    })();

    const id = window.setInterval(() => refresh(), 2500);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const active = orders.filter((o) => o.status === "NEW" || o.status === "IN_PROGRESS" || o.status === "READY");
    const done = orders.filter((o) => o.status === "COMPLETED" || o.status === "CANCELLED");
    return { active, done };
  }, [orders]);

  return (
    <div className="grid gap-6">
      {loading ? <div className="text-sm text-black/60 dark:text-slate-200/70">Loading…</div> : null}
      {error ? <div className="rounded-xl border border-red-500/30 bg-red-50 p-2 text-xs text-red-700">{error}</div> : null}

      <section className="ui-card p-6">
        <div className="text-sm font-semibold">Active orders</div>
        <div className="mt-3 grid gap-3">
          {grouped.active.map((o) => (
            <article
              key={o.id}
              className={[
                "rounded-2xl border p-4 shadow-soft",
                o.status === "READY"
                  ? "border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/25"
                  : "border-black/10 bg-white/80 dark:border-white/10 dark:bg-slate-900/70"
              ].join(" ")}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">
                    {o.table.label} · <span className="text-black/60 dark:text-slate-200/70">{o.status}</span>
                  </div>
                  <div className="text-xs text-black/50 dark:text-slate-200/60">{new Date(o.createdAt).toLocaleString()}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="ui-btn px-3 py-2 dark:bg-slate-900/50 dark:hover:bg-slate-900/70"
                    onClick={async () => {
                      await fetch("/api/kitchen/orders", {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ id: o.id, next: "IN_PROGRESS" })
                      });
                      await refresh();
                    }}
                  >
                    In progress
                  </button>
                  <button
                    className="ui-btn px-3 py-2 dark:bg-slate-900/50 dark:hover:bg-slate-900/70"
                    onClick={async () => {
                      await fetch("/api/kitchen/orders", {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ id: o.id, next: "READY" })
                      });
                      await refresh();
                    }}
                  >
                    Ready
                  </button>
                  <button
                    className="ui-btn ui-btn-primary px-3 py-2 text-xs font-semibold"
                    onClick={async () => {
                      await fetch("/api/kitchen/orders", {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ id: o.id, next: "COMPLETED" })
                      });
                      await refresh();
                    }}
                  >
                    Complete
                  </button>
                </div>
              </div>

              {o.note ? (
                <div className="mt-2 rounded-xl bg-black/5 p-2 text-xs text-black/70 dark:bg-white/10 dark:text-slate-100/80">
                  Note: {o.note}
                </div>
              ) : null}

              <ul className="mt-3 divide-y divide-black/10 dark:divide-white/10">
                {o.items.map((it) => (
                  <li key={it.id} className="flex items-center justify-between py-2 text-sm dark:text-slate-100/90">
                    <span>
                      <span className="font-medium">{it.quantity}×</span> {it.name}
                    </span>
                    {it.price ? <span className="text-black/60 dark:text-slate-200/70">{it.price}</span> : null}
                  </li>
                ))}
              </ul>
            </article>
          ))}

          {grouped.active.length === 0 ? <div className="text-sm text-black/60 dark:text-slate-200/70">No active orders.</div> : null}
        </div>
      </section>

      <section className="ui-card p-6">
        <div className="text-sm font-semibold">Recent completed</div>
        <div className="mt-3 grid gap-2">
          {grouped.done.slice(0, 10).map((o) => (
            <div
              key={o.id}
              className="flex items-center justify-between rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-xs dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100/85"
            >
              <span>
                {o.table.label} · {o.status} · {new Date(o.createdAt).toLocaleTimeString()}
              </span>
              <span className="text-black/60 dark:text-slate-200/70">{o.items.reduce((s, i) => s + i.quantity, 0)} items</span>
            </div>
          ))}
          {grouped.done.length === 0 ? <div className="text-sm text-black/60 dark:text-slate-200/70">Nothing completed yet.</div> : null}
        </div>
      </section>
    </div>
  );
}

