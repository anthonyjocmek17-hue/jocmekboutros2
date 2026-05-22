"use client";

import { useMemo, useState } from "react";
import { CategoryTabs, type MenuCategory } from "@/components/CategoryTabs";
import { useCart } from "@/components/cart/useCart";
import { useToast } from "@/components/toast/toast";

type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  ingredients: string | null;
  price: string | null;
  isOutOfStock: boolean;
};

export function MenuClient({ categories, items }: { categories: MenuCategory[]; items: MenuItem[] }) {
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(categories[0]?.id ?? null);
  const cart = useCart();
  const toast = useToast();

  const teleportToCart = (fromEl: HTMLElement) => {
    const target = (document.getElementById("cart-teleport-badge") ??
      document.getElementById("cart-teleport-target")) as HTMLElement | null;
    if (!target) return;

    const a = fromEl.getBoundingClientRect();
    const b = target.getBoundingClientRect();

    const startX = a.left + a.width / 2;
    const startY = a.top + a.height / 2;
    const endX = b.left + b.width / 2;
    const endY = b.top + b.height / 2;

    const chip = document.createElement("div");
    chip.style.position = "fixed";
    chip.style.left = `${startX - 8}px`;
    chip.style.top = `${startY - 8}px`;
    chip.style.width = "16px";
    chip.style.height = "16px";
    chip.style.borderRadius = "9999px";
    chip.style.background = "#3b82f6"; // blue
    chip.style.boxShadow = "0 10px 30px rgba(0,0,0,.15)";
    chip.style.zIndex = "9999";
    chip.style.pointerEvents = "none";

    document.body.appendChild(chip);

    const dx = endX - startX;
    const dy = endY - startY;

    const anim = chip.animate(
      [
        { transform: "translate(0px, 0px) scale(1)", opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.5)`, opacity: 0.9 }
      ],
      { duration: 520, easing: "cubic-bezier(.2,.8,.2,1)" }
    );

    anim.onfinish = () => chip.remove();
  };

  const activeItems = useMemo(() => {
    if (!activeCategoryId) return items;
    return items.filter((i) => i.categoryId === activeCategoryId);
  }, [activeCategoryId, items]);

  return (
    <section className="space-y-4">
      <div className="ui-card p-4">
        <CategoryTabs
          categories={categories}
          onSelect={setActiveCategoryId}
          onScrollToCategory={(id) => {
            const el = document.getElementById(`cat-${id}`);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      </div>

      <div className="space-y-6">
        {categories
          .filter((c) => (activeCategoryId ? c.id === activeCategoryId : true))
          .map((c) => {
            const categoryItems = items.filter((it) => it.categoryId === c.id);
            return (
              <div key={c.id} id={`cat-${c.id}`} className="scroll-mt-28">
                <div className="menu-title mb-2 text-xs font-semibold text-accent">{c.name}</div>
                <div className="grid gap-3">
                  {categoryItems.map((it) => (
                    <article
                      key={it.id}
                      className="ui-card p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-base font-semibold tracking-tight">{it.name}</div>
                          {it.description ? <div className="mt-1 text-sm text-black/65">{it.description}</div> : null}
                          {it.ingredients ? (
                            <div className="mt-1 text-xs text-black/55 dark:text-slate-200/70">
                              <span className="font-medium text-black/45 dark:text-slate-200/55">Ingredients: </span>
                              {it.ingredients}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          {it.price ? (
                            <div className="rounded-full border border-accent/15 bg-white/80 px-3 py-1 text-sm font-semibold text-ink">
                              {it.price}
                            </div>
                          ) : null}
                          {it.isOutOfStock ? (
                            <div className="ui-badge-warn">
                              Out of stock
                            </div>
                          ) : null}
                          <button
                            disabled={it.isOutOfStock}
                            className={[
                              "ui-btn rounded-full border-transparent px-3 py-2 text-xs",
                              it.isOutOfStock ? "bg-black/30 text-white" : "ui-btn-primary"
                            ].join(" ")}
                            onClick={(e) => {
                              teleportToCart(e.currentTarget);
                              cart.addLine({ menuItemId: it.id, name: it.name, price: it.price }, 1);
                              toast.push({ title: "Added to cart", description: it.name });
                            }}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}

                  {categoryItems.length === 0 ? (
                    <div className="ui-card p-6 text-sm text-black/60">
                      No items in this category yet.
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
      </div>
    </section>
  );
}

