import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createCategory, deleteCategory } from "./actions";

export default async function CategoriesAdminPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const categories = await db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });

  return (
    <div className="space-y-6">
      <div className="ui-card p-6">
        <h1 className="menu-title text-xs font-semibold text-accent">Categories</h1>
        <form action={createCategory} className="mt-4 grid gap-3 md:grid-cols-[1fr_140px_140px]">
          <input
            name="name"
            placeholder="Category name (e.g., Burgers)"
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-accent/30 focus:ring dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
            required
          />
          <input
            name="sortOrder"
            placeholder="Sort"
            type="number"
            defaultValue={0}
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-accent/30 focus:ring dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
          />
          <button className="ui-btn ui-btn-accent px-4 py-2 text-sm font-semibold shadow-menu">Add</button>
        </form>
      </div>

      <div className="ui-card p-6">
        <div className="text-sm text-black/60 dark:text-slate-200/70">Existing</div>
        <ul className="mt-3 divide-y divide-black/10 dark:divide-white/10">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <div className="text-sm font-medium">{c.name}</div>
                <div className="text-xs text-black/50 dark:text-slate-200/60">Sort: {c.sortOrder}</div>
              </div>
              <form
                action={async () => {
                  "use server";
                  await deleteCategory(c.id);
                }}
              >
                <button className="ui-btn px-3 py-2 text-xs dark:bg-slate-900/50 dark:hover:bg-slate-900/70">Delete</button>
              </form>
            </li>
          ))}
          {categories.length === 0 ? (
            <li className="py-6 text-sm text-black/60 dark:text-slate-200/70">No categories yet.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

