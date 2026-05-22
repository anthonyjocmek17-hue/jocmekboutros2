"use client";

import { useEffect, useState } from "react";

export type MenuCategory = {
  id: string;
  name: string;
};

export function CategoryTabs({
  categories,
  onSelect,
  onScrollToCategory
}: {
  categories: MenuCategory[];
  onSelect: (categoryId: string | null) => void;
  onScrollToCategory?: (categoryId: string) => void;
}) {
  const [active, setActive] = useState<string | null>(categories[0]?.id ?? null);

  useEffect(() => {
    onSelect(active);
  }, [active, onSelect]);

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((c) => {
        const isActive = c.id === active;
        return (
          <button
            key={c.id}
            onClick={() => {
              setActive(c.id);
              onScrollToCategory?.(c.id);
            }}
            className={[
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              isActive
                ? "bg-ink text-white shadow-menu ring-1 ring-accent/20 dark:bg-slate-100 dark:text-slate-900"
                : "border border-black/10 bg-white/65 text-ink shadow-sm hover:bg-white hover:ring-1 hover:ring-accent/15 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100/90 dark:hover:bg-slate-900/75 dark:hover:ring-white/10"
            ].join(" ")}
          >
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

