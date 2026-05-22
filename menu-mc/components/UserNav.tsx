"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { TempQuickLogin } from "@/components/TempQuickLogin";

export function UserNav() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const role = (session as any)?.role as string | undefined;
  const tableId = (session as any)?.tableId as string | null | undefined;
  const email = session?.user?.email ?? null;

  if (status === "loading") {
    return <div className="text-xs text-black/50">…</div>;
  }

  if (!session) {
    return (
      <div className="flex items-center gap-1">
        <Link href="/login" className="ui-btn rounded-full border-transparent bg-transparent hover:bg-white/70">
          Sign in
        </Link>
        <TempQuickLogin />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        aria-label="Logout"
        title={role === "TABLE" ? "Table session" : email ?? "Logout"}
        className="ui-btn rounded-full border-transparent bg-transparent hover:bg-white/70"
        onClick={async () => {
          await signOut({ redirect: false, callbackUrl: "/" });
          router.replace("/");
          router.refresh();
        }}
      >
        Logout
      </button>
    </div>
  );
}

