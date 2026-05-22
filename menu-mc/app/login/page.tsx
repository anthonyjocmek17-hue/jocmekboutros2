"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="ui-card mx-auto max-w-md p-6">
      <h1 className="menu-title mb-1 text-xs font-semibold text-accent">Sign in</h1>
      <p className="mb-6 text-sm text-black/60 dark:text-slate-200/70">
        Private sign-in for tables, kitchen, and admin. This screen doesn’t reveal what account type you’re using.
      </p>

      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setLoading(true);
          // redirect: false avoids NextAuth's window.location.href hard reload (theme flash).
          const res = await signIn("credentials", { email, password, redirect: false, callbackUrl: "/" });
          if (res?.error || !res?.ok) {
            setError("Invalid email or password.");
            setLoading(false);
            return;
          }
          router.replace(res.url ?? "/");
          router.refresh();
        }}
      >
        <label className="block">
          <span className="text-xs text-black/60 dark:text-slate-200/70">Login</span>
          <input
            className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-accent/30 focus:ring dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="text"
            autoComplete="username"
            required
            placeholder="Email (e.g. table1@menu.local)"
          />
        </label>
        <label className="block">
          <span className="text-xs text-black/60 dark:text-slate-200/70">Password</span>
          <input
            className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-accent/30 focus:ring dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            required
          />
        </label>

        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-50 p-2 text-xs text-red-700">{error}</div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="ui-btn ui-btn-accent w-full px-4 py-2 text-sm font-semibold shadow-menu disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}

