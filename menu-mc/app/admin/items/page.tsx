import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createItem, deleteItem, setPrepTime, toggleItemAvailability, toggleOutOfStock, updateItemMeta } from "./actions";
import { AdminMenuBuilder } from "./ui/AdminMenuBuilder";

export default async function ItemsAdminPage({
  searchParams
}: {
  searchParams?: Promise<{ categoryId?: string | string[] }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const categories = await db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });

  const sp = searchParams ? await searchParams : undefined;
  const categoryIdParam = typeof sp?.categoryId === "string" ? sp.categoryId : undefined;
  const activeCategoryId = categoryIdParam && categories.some((c) => c.id === categoryIdParam)
    ? categoryIdParam
    : (categories[0]?.id ?? "");

  const items = await db.menuItem.findMany({
    where: activeCategoryId ? { categoryId: activeCategoryId } : undefined,
    include: { category: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });

  return (
    <div className="space-y-6">
      <div className="ui-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-black/70 dark:text-slate-100/80">
            Active category:{" "}
            <span className="font-semibold">
              {categories.find((c) => c.id === activeCategoryId)?.name ?? "—"}
            </span>{" "}
            <span className="text-black/50 dark:text-slate-200/60">({items.length} items)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/admin/items?categoryId=${c.id}`}
                className={[
                  "rounded-full px-3 py-2 text-xs font-semibold",
                  c.id === activeCategoryId
                    ? "bg-ink text-white dark:bg-slate-100 dark:text-slate-900"
                    : "border border-black/10 bg-white hover:bg-black/5 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100/90 dark:hover:bg-slate-900/75"
                ].join(" ")}
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <AdminMenuBuilder
        categories={categories.map((c) => ({ id: c.id, name: c.name, sortOrder: c.sortOrder }))}
        items={items.map((it) => ({
          id: it.id,
          name: it.name,
          description: it.description,
          ingredients: it.ingredients,
          price: it.price,
          sortOrder: it.sortOrder,
          isAvailable: it.isAvailable,
          isOutOfStock: it.isOutOfStock,
          prepTimeMinutes: it.prepTimeMinutes,
          categoryId: it.categoryId,
          categoryName: it.category.name
        }))}
        activeCategoryId={activeCategoryId}
        createItemForm={
          <form action={createItem} className="grid gap-3">
            <label className="block">
              <span className="text-xs text-black/60 dark:text-slate-200/70">Category</span>
              <input type="hidden" name="categoryId" value={activeCategoryId} />
              <select
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-accent/30 focus:ring dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
                value={activeCategoryId}
                disabled
                aria-readonly
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-black/60 dark:text-slate-200/70">Name</span>
              <input
                name="name"
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-accent/30 focus:ring dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
                placeholder="Item name"
                required
              />
            </label>
            <label className="block">
              <span className="text-xs text-black/60 dark:text-slate-200/70">Price (optional)</span>
              <input
                name="price"
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-accent/30 focus:ring dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
                placeholder="$12.99"
              />
            </label>
            <label className="block">
              <span className="text-xs text-black/60 dark:text-slate-200/70">Sort order</span>
              <input
                name="sortOrder"
                type="number"
                defaultValue={0}
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-accent/30 focus:ring dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
              />
            </label>
            <label className="block">
              <span className="text-xs text-black/60 dark:text-slate-200/70">Prep time (minutes)</span>
              <input
                name="prepTimeMinutes"
                type="number"
                defaultValue={10}
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-accent/30 focus:ring dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
              />
            </label>
            <label className="block">
              <span className="text-xs text-black/60 dark:text-slate-200/70">Description (optional)</span>
              <textarea
                name="description"
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-accent/30 focus:ring dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
                placeholder="Short description"
                rows={4}
              />
            </label>
            <label className="block">
              <span className="text-xs text-black/60 dark:text-slate-200/70">Ingredients (optional)</span>
              <textarea
                name="ingredients"
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-accent/30 focus:ring dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
                placeholder="e.g. beef patty, cheddar, lettuce, tomato, sesame bun (comma-separated)"
                rows={3}
              />
            </label>
            <button className="ui-btn ui-btn-accent px-4 py-2 text-sm font-semibold shadow-menu">Add item</button>
          </form>
        }
      />

      <div className="ui-card p-6">
        <div className="text-sm font-semibold">Actions</div>
        <p className="mt-1 text-sm text-black/60 dark:text-slate-200/70">
          Use these controls to update stock/visibility/prep-time. (These actions refresh the page.)
        </p>
        <ul className="mt-4 divide-y divide-black/10 dark:divide-white/10">
          {items.map((it) => (
            <li key={it.id} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">
                    {it.name} {it.price ? <span className="text-black/60 dark:text-slate-200/70">· {it.price}</span> : null}
                  </div>
                  <div className="text-xs text-black/50 dark:text-slate-200/60">
                    {it.category.name} · sort {it.sortOrder} · prep {it.prepTimeMinutes}m ·{" "}
                    {it.isAvailable ? "visible" : "hidden"} · {it.isOutOfStock ? "out of stock" : "in stock"}
                  </div>
                </div>
                <div className="flex gap-2">
                  <form
                    action={async () => {
                      "use server";
                      await toggleOutOfStock(it.id);
                    }}
                  >
                    <button className="ui-btn px-3 py-2 text-xs dark:bg-slate-900/50 dark:hover:bg-slate-900/70">
                      {it.isOutOfStock ? "Mark in stock" : "Mark out of stock"}
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await toggleItemAvailability(it.id);
                    }}
                  >
                    <button className="ui-btn px-3 py-2 text-xs dark:bg-slate-900/50 dark:hover:bg-slate-900/70">
                      {it.isAvailable ? "Hide" : "Show"}
                    </button>
                  </form>
                  <form
                    action={async (formData: FormData) => {
                      "use server";
                      const minutes = Number(formData.get("prepTimeMinutes"));
                      await setPrepTime(it.id, minutes);
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      name="prepTimeMinutes"
                      type="number"
                      defaultValue={it.prepTimeMinutes}
                      className="w-20 rounded-xl border border-black/10 bg-white px-2 py-2 text-xs dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
                      title="Prep minutes"
                    />
                    <button className="ui-btn px-3 py-2 text-xs dark:bg-slate-900/50 dark:hover:bg-slate-900/70">
                      Set
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await deleteItem(it.id);
                    }}
                  >
                    <button className="ui-btn px-3 py-2 text-xs dark:bg-slate-900/50 dark:hover:bg-slate-900/70">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
              <form action={updateItemMeta} className="mt-3 grid gap-2 border-t border-black/10 pt-3 dark:border-white/10">
                <input type="hidden" name="itemId" value={it.id} />
                <label className="block text-xs text-black/60 dark:text-slate-200/70">
                  Description
                  <textarea
                    name="description"
                    rows={2}
                    defaultValue={it.description ?? ""}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-accent/30 focus:ring dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
                    placeholder="Short description"
                  />
                </label>
                <label className="block text-xs text-black/60 dark:text-slate-200/70">
                  Ingredients (for the menu assistant)
                  <textarea
                    name="ingredients"
                    rows={2}
                    defaultValue={it.ingredients ?? ""}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-accent/30 focus:ring dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
                    placeholder="Comma-separated: beef patty, cheddar, lettuce…"
                  />
                </label>
                <button
                  type="submit"
                  className="ui-btn w-fit px-3 py-2 text-xs font-semibold dark:bg-slate-900/50 dark:hover:bg-slate-900/70"
                >
                  Save description & ingredients
                </button>
              </form>
            </li>
          ))}
          {items.length === 0 ? (
            <li className="py-6 text-sm text-black/60 dark:text-slate-200/70">No menu items yet.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

