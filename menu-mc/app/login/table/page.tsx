"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function TableLoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const t = sp.get("t");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!t) {
      setMsg("Missing token. Scan a valid table QR or open the full link from your host.");
      return;
    }

    let cancelled = false;

    (async () => {
      const res = await signIn("credentials", {
        tableToken: t,
        email: "qr@table.menu.local",
        password: "-",
        redirect: false
      });

      if (cancelled) return;

      if (res && typeof res === "object" && "error" in res && (res as { error?: string }).error) {
        setMsg("This QR link is invalid or expired. Ask staff to re-print the code from Admin → Table 1 QR.");
        return;
      }

      router.replace("/");
      router.refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [t, router]);

  return (
    <div className="ui-card mx-auto max-w-md p-6 text-center">
      {msg ? (
        <p className="text-sm text-red-700 dark:text-red-300">{msg}</p>
      ) : (
        <p className="text-sm text-black/70 dark:text-slate-200/80">Signing you in…</p>
      )}
    </div>
  );
}

export default function TableLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="ui-card mx-auto max-w-md p-6 text-center text-sm text-black/60 dark:text-slate-200/70">
          Loading…
        </div>
      }
    >
      <TableLoginInner />
    </Suspense>
  );
}
