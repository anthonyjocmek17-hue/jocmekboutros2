import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createUser, updateUser } from "./actions";
import { DeleteAccountButton } from "./DeleteAccountButton";

const ROLE_ORDER: Record<string, number> = { ADMIN: 0, KITCHEN: 1, WAITER: 2, TABLE: 3 };

export const dynamic = "force-dynamic";

export default async function AccountsPage({
  searchParams
}: {
  searchParams?: Promise<{ err?: string; created?: string; updated?: string; deleted?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if ((session as { role?: string }).role !== "ADMIN") redirect("/");

  const sp = searchParams ? await searchParams : {};
  const err = typeof sp.err === "string" ? sp.err : undefined;
  const created = sp.created === "1";
  const updated = sp.updated === "1";
  const deleted = sp.deleted === "1";

  const [users, tables] = await Promise.all([
    db.user.findMany({
      include: { table: { select: { id: true, label: true } } },
      orderBy: { email: "asc" }
    }),
    db.table.findMany({ orderBy: { label: "asc" } })
  ]);

  const sorted = [...users].sort((a, b) => {
    const ro = (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9);
    if (ro !== 0) return ro;
    const la = a.table?.label ?? "";
    const lb = b.table?.label ?? "";
    if (la !== lb) return la.localeCompare(lb);
    return a.email.localeCompare(b.email);
  });

  return (
    <div className="space-y-6">
      <div className="ui-card p-6">
        <h1 className="menu-title text-xs font-semibold text-accent">Account management</h1>
        <p className="mt-2 text-sm text-black/70 dark:text-slate-100/80">
          Create, edit, and remove staff and table logins. Table accounts must be linked to a floor table.
        </p>
      </div>

      {err ? (
        <div className="rounded-xl border border-red-500/30 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-100">
          {err}
        </div>
      ) : null}
      {created ? (
        <div className="rounded-xl border border-emerald-600/25 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-100">
          Account created.
        </div>
      ) : null}
      {updated ? (
        <div className="rounded-xl border border-emerald-600/25 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-100">
          Account updated.
        </div>
      ) : null}
      {deleted ? (
        <div className="rounded-xl border border-emerald-600/25 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-100">
          Account removed.
        </div>
      ) : null}

      <div className="ui-card p-6">
        <div className="text-sm font-semibold">Create account</div>
        <p className="mt-1 text-xs text-black/55 dark:text-slate-200/65">
          Password must be at least 8 characters. For <span className="font-medium">Table</span> role, pick the physical table this QR/login represents.
        </p>
        <form action={createUser} className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <label className="block lg:col-span-2">
            <span className="text-xs text-black/60 dark:text-slate-200/70">Email</span>
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-accent/30 focus:ring dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
              placeholder="name@example.com"
            />
          </label>
          <label className="block lg:col-span-1">
            <span className="text-xs text-black/60 dark:text-slate-200/70">Password</span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-accent/30 focus:ring dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
              placeholder="min 8 chars"
            />
          </label>
          <label className="block">
            <span className="text-xs text-black/60 dark:text-slate-200/70">Role</span>
            <select
              name="role"
              className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
              defaultValue="WAITER"
            >
              <option value="ADMIN">Admin</option>
              <option value="KITCHEN">Kitchen</option>
              <option value="WAITER">Waiter</option>
              <option value="TABLE">Table</option>
            </select>
          </label>
          <label className="block lg:col-span-2">
            <span className="text-xs text-black/60 dark:text-slate-200/70">Table (required for Table role)</span>
            <select
              name="tableId"
              className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
            >
              <option value="">— None —</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end lg:col-span-6">
            <button type="submit" className="ui-btn ui-btn-accent px-4 py-2 text-sm font-semibold">
              Create account
            </button>
          </div>
        </form>
      </div>

      <div className="ui-card overflow-x-auto p-6">
        <div className="text-sm font-semibold">All accounts ({sorted.length})</div>
        <p className="mt-1 text-xs text-black/55 dark:text-slate-200/65">
          Sorted by role, then table, then email. Editing your own email or password will apply on next sign-in.
        </p>
        <div className="mt-4 min-w-[720px] space-y-4">
          {sorted.map((u) => (
            <div
              key={u.id}
              className="rounded-xl border border-black/10 p-4 dark:border-white/10 dark:bg-slate-900/30"
            >
              <form action={updateUser} className="grid gap-3 md:grid-cols-12 md:items-end">
                <input type="hidden" name="userId" value={u.id} />
                <label className="block md:col-span-3">
                  <span className="text-xs text-black/60 dark:text-slate-200/70">Email</span>
                  <input
                    name="email"
                    type="email"
                    required
                    defaultValue={u.email}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs text-black/60 dark:text-slate-200/70">Role</span>
                  <select
                    name="role"
                    defaultValue={u.role}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="KITCHEN">Kitchen</option>
                    <option value="WAITER">Waiter</option>
                    <option value="TABLE">Table</option>
                  </select>
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs text-black/60 dark:text-slate-200/70">Table</span>
                  <select
                    name="tableId"
                    defaultValue={u.tableId ?? ""}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
                  >
                    <option value="">— None —</option>
                    {tables.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block md:col-span-3">
                  <span className="text-xs text-black/60 dark:text-slate-200/70">New password (optional)</span>
                  <input
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Leave blank to keep"
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
                  />
                </label>
                <div className="flex md:col-span-2">
                  <button type="submit" className="ui-btn px-3 py-2 text-xs font-semibold dark:bg-slate-900/50 dark:hover:bg-slate-900/70">
                    Save
                  </button>
                </div>
              </form>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-black/10 pt-3 dark:border-white/10">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/45 dark:text-slate-200/55">
                  <span>ID: {u.id.slice(0, 12)}…</span>
                  {u.table ? (
                    <span>Linked table: {u.table.label}</span>
                  ) : u.role === "TABLE" ? (
                    <span className="text-amber-700 dark:text-amber-300">No table linked</span>
                  ) : null}
                  <span>Created {u.createdAt.toLocaleDateString()}</span>
                </div>
                <DeleteAccountButton userId={u.id} />
              </div>
            </div>
          ))}
          {sorted.length === 0 ? (
            <p className="text-sm text-black/60 dark:text-slate-200/70">No accounts yet. Run the seed script or create one above.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
