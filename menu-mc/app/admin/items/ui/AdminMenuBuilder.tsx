"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Category = { id: string; name: string; sortOrder: number };
type Item = {
  id: string;
  name: string;
  description: string | null;
  ingredients: string | null;
  price: string | null;
  sortOrder: number;
  isAvailable: boolean;
  isOutOfStock: boolean;
  prepTimeMinutes: number;
  categoryId: string;
  categoryName: string;
};

export function AdminMenuBuilder({
  categories,
  items,
  createItemForm,
  activeCategoryId
}: {
  categories: Category[];
  items: Item[];
  createItemForm: React.ReactNode;
  activeCategoryId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [localCategoryId, setLocalCategoryId] = useState(activeCategoryId);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setLocalCategoryId(activeCategoryId);
  }, [activeCategoryId]);

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((it) => {
        if (!q) return true;
        return (
          it.name.toLowerCase().includes(q) ||
          (it.description ? it.description.toLowerCase().includes(q) : false) ||
          (it.ingredients ? it.ingredients.toLowerCase().includes(q) : false)
        );
      });
  }, [items, activeCategoryId, query]);

  const activeCategoryName = useMemo(() => {
    return categories.find((c) => c.id === activeCategoryId)?.name ?? "Category";
  }, [categories, activeCategoryId]);

  return (
    <div className="space-y-6">
      <div className="ui-card p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="menu-title text-xs font-semibold text-accent">Menu builder</h1>
            <p className="mt-2 text-sm text-black/60 dark:text-slate-200/70">
              Switch categories to see and edit current items instantly.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs text-black/60 dark:text-slate-200/70">Category</span>
              <select
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-accent/30 focus:ring dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
                value={localCategoryId}
                onChange={(e) => {
                  const next = e.target.value;
                  setLocalCategoryId(next);
                  // In some Next.js setups, querystring navigation can get "stuck" due to caching.
                  // Force a real navigation so the server component re-renders with the new category.
                  const sp = new URLSearchParams(searchParams?.toString());
                  sp.set("categoryId", next);
                  const url = `/admin/items?${sp.toString()}`;
                  startTransition(() => router.replace(url));
                  window.location.assign(url);
                }}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {isPending ? <div className="text-xs text-black/50 dark:text-slate-200/60 sm:col-span-2">Loading…</div> : null}
            <label className="block">
              <span className="text-xs text-black/60 dark:text-slate-200/70">Search</span>
              <input
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-accent/30 focus:ring dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find an item…"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <div className="ui-card p-6">
          <div className="text-sm font-semibold">Add item to “{activeCategoryName}”</div>
          <div className="mt-3">{createItemForm}</div>
          <div className="mt-3 text-xs text-black/50 dark:text-slate-200/60">
            Tip: keep this category selected while you add multiple items.
          </div>
        </div>

        <div className="ui-card p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">Current items</div>
            <div className="text-xs text-black/60 dark:text-slate-200/70">{visibleItems.length} shown</div>
          </div>
          <ul className="mt-3 divide-y divide-black/10 dark:divide-white/10">
            {visibleItems.map((it) => (
              <li key={it.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">
                      {it.name} {it.price ? <span className="text-black/60 dark:text-slate-200/70">· {it.price}</span> : null}
                    </div>
                    <div className="text-xs text-black/50 dark:text-slate-200/60">
                      {it.categoryName} · sort {it.sortOrder} · prep {it.prepTimeMinutes}m ·{" "}
                      {it.isAvailable ? "visible" : "hidden"} · {it.isOutOfStock ? "out of stock" : "in stock"}
                    </div>
                    {it.description ? (
                      <div className="mt-1 text-sm text-black/70 dark:text-slate-100/80">{it.description}</div>
                    ) : null}
                    {it.ingredients ? (
                      <div className="mt-1 text-xs text-black/55 dark:text-slate-200/65">
                        <span className="font-semibold text-black/50 dark:text-slate-200/60">Ingredients: </span>
                        {it.ingredients}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-xs text-black/40 dark:text-slate-200/55">
                    Use the actions below (Hide/Stock/Set/Delete).
                  </div>
                </div>
              </li>
            ))}
            {visibleItems.length === 0 ? (
              <li className="py-6 text-sm text-black/60 dark:text-slate-200/70">No items match this category/search.</li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  );
}

