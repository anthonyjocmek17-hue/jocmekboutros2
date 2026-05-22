import { headers } from "next/headers";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { signTableQrToken } from "@/lib/tableQrToken";

export const dynamic = "force-dynamic";

export default async function Table1QrPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if ((session as { role?: string }).role !== "ADMIN") redirect("/");

  const hdrs = await headers();
  const base =
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    `${hdrs.get("x-forwarded-proto") ?? "http"}://${hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000"}`;

  let token: string;
  try {
    token = signTableQrToken("Table 1", 365 * 24 * 60 * 60 * 1000);
  } catch {
    return (
      <div className="ui-card mx-auto max-w-lg p-6 space-y-3 text-sm text-black/80 dark:text-slate-100/90">
        <h1 className="menu-title text-xs font-semibold text-accent">Table 1 QR</h1>
        <p>
          Add <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">TABLE_QR_SECRET</code> (recommended) or
          ensure <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">NEXTAUTH_SECRET</code> is set in{" "}
          <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">.env</code>, then restart{" "}
          <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">next dev</code>.
        </p>
      </div>
    );
  }

  const loginUrl = `${base}/login/table?t=${encodeURIComponent(token)}`;
  const qrSrc = "/api/admin/table-1-qr";

  return (
    <div className="space-y-6">
      <div className="ui-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="menu-title text-xs font-semibold text-accent">Table 1 — login QR</h1>
            <p className="mt-2 text-sm text-black/70 dark:text-slate-100/80">
              Guests scan this code to open the site and sign in as the <span className="font-medium">Table 1</span>{" "}
              account (no typing). The link is signed with your server secret — treat printed codes like keys. The image
              below is a real PNG from this app (you can also right‑click it and choose Save image as…).
            </p>
          </div>
          <Link
            href="/admin"
            className="ui-btn rounded-full border border-black/10 px-3 py-2 text-xs dark:border-white/10 dark:bg-slate-900/50 dark:hover:bg-slate-900/70"
          >
            ← Admin home
          </Link>
        </div>
      </div>

      <div className="ui-card flex flex-col items-center gap-4 p-8 md:flex-row md:items-start md:justify-center md:gap-10">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-2xl border border-black/10 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-slate-900/40">
            {/* eslint-disable-next-line @next/next/no-img-element -- API returns PNG bytes */}
            <img src={qrSrc} width={280} height={280} alt="QR code: sign in as Table 1" className="block" />
          </div>
          <a
            href="/api/admin/table-1-qr?download=1"
            download="table-1-qr.png"
            className="ui-btn rounded-full border border-black/15 px-4 py-2 text-xs font-medium dark:border-white/15 dark:bg-slate-900/50 dark:hover:bg-slate-900/70"
          >
            Download PNG (512×512)
          </a>
        </div>
        <div className="max-w-xl space-y-3 text-sm text-black/75 dark:text-slate-100/85">
          <p className="font-semibold text-black dark:text-slate-100">How it works</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Print this QR and place it on Table 1.</li>
            <li>Scanning opens <code className="rounded bg-black/5 px-1 dark:bg-white/10">/login/table?t=…</code>.</li>
            <li>The app verifies the token and signs the guest in as the user linked to label “Table 1”.</li>
          </ol>
          <p className="text-xs text-black/55 dark:text-slate-200/65">
            Requires a seeded table user for <span className="font-medium">table1@menu.local</span> (see{" "}
            <code className="rounded bg-black/5 px-1 dark:bg-white/10">npm run seed</code>). The QR URL must use the
            same host your guests use (match <code className="rounded bg-black/5 px-1 dark:bg-white/10">NEXTAUTH_URL</code>{" "}
            to <code className="rounded bg-black/5 px-1 dark:bg-white/10">http://127.0.0.1:3000</code> vs{" "}
            <code className="rounded bg-black/5 px-1 dark:bg-white/10">http://localhost:3000</code>).
          </p>
          <details className="rounded-xl border border-black/10 p-3 text-xs dark:border-white/10">
            <summary className="cursor-pointer font-medium">Show full URL (for testing)</summary>
            <p className="mt-2 break-all font-mono text-[11px] text-black/70 dark:text-slate-200/80">{loginUrl}</p>
          </details>
        </div>
      </div>
    </div>
  );
}
