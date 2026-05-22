"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { CartButton } from "@/components/cart/CartButton";
import { UserNav } from "@/components/UserNav";

function TabLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={[
        "ui-btn rounded-full border-transparent bg-transparent hover:bg-white/70",
        "dark:text-slate-100/90 dark:hover:bg-white/10"
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

export function AppNav() {
  const { data: session } = useSession();
  const role = (session as any)?.role as string | undefined;

  const showAdmin = role === "ADMIN";
  const showKitchen = role === "KITCHEN" || role === "ADMIN";
  const showWaiter = role === "WAITER" || role === "ADMIN";
  const showOrder = role === "TABLE";

  return (
    <nav className="flex flex-wrap items-center justify-end gap-1 rounded-full border border-black/10 bg-white/65 p-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/55">
      <TabLink href="/">Menu</TabLink>
      <CartButton />
      {showOrder ? <TabLink href="/order">Order</TabLink> : null}
      {showWaiter ? <TabLink href="/waiter">Waiter</TabLink> : null}
      {showKitchen ? <TabLink href="/kitchen">Kitchen</TabLink> : null}
      {showAdmin ? <TabLink href="/admin">Admin</TabLink> : null}
      <div className="ml-1">
        <UserNav />
      </div>
    </nav>
  );
}

