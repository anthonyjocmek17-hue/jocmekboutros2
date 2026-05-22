"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// TEMP: quick role login popup (remove when user says "remove temp")
const TEMP_ACCOUNTS = {
  table: { email: "table1@menu.local", password: "table12345", label: "Table (demo)" },
  kitchen: { email: "kitchen@menu.local", password: "kitchen12345", label: "Kitchen (demo)" },
  waiter: { email: "waiter@menu.local", password: "waiter12345", label: "Waiter (demo)" },
  admin: { email: "admin@menu.local", password: "admin12345", label: "Admin (demo)" }
} as const;

export function TempQuickLogin() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<null | keyof typeof TEMP_ACCOUNTS>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <button
        className="rounded-full px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-white/80"
        onClick={() => setOpen(true)}
        title="TEMP quick login"
      >
        Temp login
      </button>

      {open && mounted
        ? createPortal(
            <div
              className="fixed inset-0 z-[2147483647] grid place-items-center bg-black/30 p-4"
              role="dialog"
              aria-modal="true"
            >
              <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white/90 p-4 shadow-menu backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-blue-700">TEMP</div>
                    <div className="text-sm font-semibold">Quick login</div>
                    <div className="mt-1 text-xs text-black/60">One tap to sign in as a demo role.</div>
                  </div>
                  <button
                    className="rounded-full px-2 py-1 text-xs hover:bg-black/5"
                    onClick={() => {
                      setOpen(false);
                      setError(null);
                    }}
                  >
                    Close
                  </button>
                </div>

                {error ? (
                  <div className="mt-3 rounded-xl border border-red-500/30 bg-red-50 p-2 text-xs text-red-700">{error}</div>
                ) : null}

                <div className="mt-3 grid gap-2">
                  {(Object.keys(TEMP_ACCOUNTS) as (keyof typeof TEMP_ACCOUNTS)[]).map((k) => {
                    const acct = TEMP_ACCOUNTS[k];
                    return (
                      <button
                        key={k}
                        disabled={loading !== null}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        onClick={async () => {
                          setError(null);
                          setLoading(k);
                          const res = await signIn("credentials", {
                            email: acct.email,
                            password: acct.password,
                            redirect: false,
                            callbackUrl: "/"
                          });
                          if (res?.error || !res?.ok) {
                            setError("Quick login failed (seed users not created yet?).");
                            setLoading(null);
                            return;
                          }
                          setOpen(false);
                          setLoading(null);
                          router.replace(res.url ?? "/");
                          router.refresh();
                        }}
                      >
                        {loading === k ? "Signing in..." : acct.label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 text-[11px] text-black/50">
                  This is a temporary dev shortcut. Ask me “remove temp” and I’ll delete it.
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

