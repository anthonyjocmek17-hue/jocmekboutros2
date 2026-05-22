"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useToast } from "@/components/toast/toast";

type Order = {
  id: string;
  status: "NEW" | "IN_PROGRESS" | "READY" | "COMPLETED" | "CANCELLED";
  note: string | null;
  estimatedReadyAt: string | null;
  createdAt: string;
  table: { label: string };
  items: { id: string; name: string; price: string | null; quantity: number }[];
};

function formatMinutes(ms: number) {
  const m = Math.ceil(ms / 60_000);
  if (m <= 1) return "1 min";
  return `${m} mins`;
}

function etaMs(order: Order) {
  if (!order.estimatedReadyAt) return null;
  const t = new Date(order.estimatedReadyAt).getTime();
  return t - Date.now();
}

export default function OrderStatusPage() {
  const { data: session } = useSession();
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const lastStatusByIdRef = useRef<Record<string, string>>({});

  const isTable = (session as any)?.role === "TABLE";

  useEffect(() => {
    if (!isTable) return;
    let mounted = true;

    async function refresh() {
      const res = await fetch("/api/table/order", { cache: "no-store" });
      if (!res.ok) {
        if (mounted) setError(await res.text());
        return;
      }
      const data = (await res.json()) as { orders: Order[] };
      if (!mounted) return;

      const next = data.orders ?? [];
      setOrders(next);
      setError(null);

      const prev = lastStatusByIdRef.current;
      for (const o of next) {
        const was = prev[o.id];
        if (was && was !== o.status && o.status === "READY") {
          toast.push({
            title: "Order ready",
            description: `Order …${o.id.slice(-6)} is ready to pick up / will be served.`
          });
        }
      }
      const map: Record<string, string> = {};
      for (const o of next) map[o.id] = o.status;
      lastStatusByIdRef.current = map;
    }

    refresh();
    const id = window.setInterval(refresh, 2500);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [isTable, toast]);

  const summary = useMemo(() => {
    if (orders.length === 0) return "";
    if (orders.length === 1) return `Order …${orders[0].id.slice(-6)}`;
    return `${orders.length} open orders`;
  }, [orders]);

  return (
    <div className="space-y-6">
      <div className="ui-card p-6">
        <h1 className="menu-title text-xs font-semibold text-accent">Order status</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-slate-200/70">
          Live updates from the kitchen. Every order you have placed that is not finished yet is listed below
          (new, in progress, or ready). {summary ? <span className="font-medium text-black/80 dark:text-slate-100/90">{summary}</span> : null}
        </p>
      </div>

      {!isTable ? (
        <div className="ui-card p-6 text-sm text-black/60 dark:text-slate-200/70">
          Log in as a table to view order status.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-50 p-2 text-xs text-red-700">{error}</div>
      ) : null}

      {isTable && orders.length === 0 ? (
        <div className="ui-card p-6 text-sm text-black/60 dark:text-slate-200/70">
          No open orders. <Link className="underline" href="/">Go to menu</Link> to place one.
        </div>
      ) : null}

      {orders.map((order, idx) => {
        const eta = etaMs(order);
        return (
          <div key={order.id} className="ui-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-black/50 dark:text-slate-200/60">Order {idx + 1}</div>
                <div className="text-sm font-semibold">{order.table.label}</div>
                <div className="text-xs text-black/50 dark:text-slate-200/60">
                  …{order.id.slice(-8)} · {new Date(order.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold dark:bg-white/10">{order.status}</div>
            </div>

            {order.status !== "READY" && order.status !== "COMPLETED" && order.estimatedReadyAt ? (
              <div className="mt-3 rounded-2xl border border-blue-600/20 bg-blue-50 p-4 text-sm text-blue-900 dark:border-sky-500/25 dark:bg-sky-950/35 dark:text-sky-100">
                Estimated time remaining:{" "}
                <span className="font-semibold">{eta != null && eta > 0 ? formatMinutes(eta) : "Soon"}</span>
              </div>
            ) : null}

            {order.status === "READY" ? (
              <div className="mt-3 rounded-2xl border border-emerald-600/20 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-500/25 dark:bg-emerald-950/35 dark:text-emerald-100">
                This order is ready.
              </div>
            ) : null}

            {order.note ? <div className="mt-3 text-sm text-black/70 dark:text-slate-100/80">Note: {order.note}</div> : null}

            <ul className="mt-4 divide-y divide-black/10 dark:divide-white/10">
              {order.items.map((it) => (
                <li key={it.id} className="flex items-center justify-between py-2 text-sm dark:text-slate-100/90">
                  <span>
                    <span className="font-medium">{it.quantity}×</span> {it.name}
                  </span>
                  {it.price ? <span className="text-black/60 dark:text-slate-200/70">{it.price}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
