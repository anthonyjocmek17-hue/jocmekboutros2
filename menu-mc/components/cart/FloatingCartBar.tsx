"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "./useCart";

export function FloatingCartBar() {
  const { totalItems } = useCart();
  const pathname = usePathname();

  if (totalItems <= 0) return null;
  if (pathname === "/cart") return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-40 w-[min(720px,calc(100%-2rem))] -translate-x-1/2">
      <Link
        href="/cart"
        className="cart-blue-pulse flex items-center justify-between rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-menu ring-1 ring-blue-500/20"
      >
        <span>View cart</span>
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs">{totalItems} items</span>
      </Link>
    </div>
  );
}

