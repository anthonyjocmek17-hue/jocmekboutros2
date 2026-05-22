"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { CartProvider } from "@/components/cart/useCart";
import { ToastProvider } from "@/components/toast/toast";

type Props = {
  children: React.ReactNode;
  /** From `getServerSession` in the root layout — avoids an extra client `/api/auth/session` fetch on load. */
  session: Session | null;
};

export function Providers({ children, session }: Props) {
  return (
    <SessionProvider session={session} refetchOnWindowFocus={false} refetchWhenOffline={false}>
      <ToastProvider>
        <CartProvider>{children}</CartProvider>
      </ToastProvider>
    </SessionProvider>
  );
}

