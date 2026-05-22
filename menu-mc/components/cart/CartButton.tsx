"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "./useCart";

export function CartButton() {
  const { totalItems } = useCart();
  const [bump, setBump] = useState(false);

  useEffect(() => {
    if (totalItems <= 0) return;
    setBump(true);
    const t = window.setTimeout(() => setBump(false), 240);
    return () => window.clearTimeout(t);
  }, [totalItems]);

  return (
    <Link
      href="/cart"
      id="cart-teleport-target"
      className={[
        "ui-btn relative rounded-full border-transparent bg-transparent hover:bg-white/70",
        bump ? "scale-[1.03] transition-transform" : ""
      ].join(" ")}
    >
      Cart
      {totalItems > 0 ? (
        <span
          id="cart-teleport-badge"
          className="cart-blue-pulse ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-semibold text-white"
        >
          {totalItems}
        </span>
      ) : null}
    </Link>
  );
}

