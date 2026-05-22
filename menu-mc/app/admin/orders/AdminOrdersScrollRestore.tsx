"use client";

import { useEffect } from "react";

/**
 * After a server action redirects to `/admin/orders?bill=…&part=…`, scroll that
 * section into view and then drop the query string so the URL stays clean.
 */
export function AdminOrdersScrollRestore() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bill = params.get("bill");
    if (!bill) return;

    const row = params.get("row");
    if (row) {
      const rowEl = document.getElementById(`bill-line-${row}`);
      if (rowEl) {
        rowEl.scrollIntoView({ behavior: "auto", block: "nearest" });
        const url = new URL(window.location.href);
        url.searchParams.delete("bill");
        url.searchParams.delete("part");
        url.searchParams.delete("row");
        window.history.replaceState({}, "", `${url.pathname}${url.hash}`);
        return;
      }
    }

    const part = params.get("part") || "bill";
    const id = part === "bill" ? `bill-${bill}` : `bill-${bill}-${part}`;
    const el =
      document.getElementById(id) ??
      document.getElementById(`bill-${bill}-meta`) ??
      document.getElementById(`bill-${bill}`);

    const run = () => {
      el?.scrollIntoView({ behavior: "auto", block: "start" });
    };
    requestAnimationFrame(() => requestAnimationFrame(run));

    const url = new URL(window.location.href);
    url.searchParams.delete("bill");
    url.searchParams.delete("part");
    url.searchParams.delete("row");
    window.history.replaceState({}, "", `${url.pathname}${url.hash}`);
  }, []);

  return null;
}
