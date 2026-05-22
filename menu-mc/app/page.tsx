import { db } from "@/lib/db";
import { MenuClient } from "./ui/MenuClient";

export default async function HomePage() {
  const categories = await db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });

  const items = await db.menuItem.findMany({
    where: { isAvailable: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });

  return (
    <main className="space-y-6">
      <div className="ui-card p-6">
        <div className="menu-title text-xs font-semibold text-accent">Menu</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Browse our items</h1>
        <p className="mt-2 text-sm text-black/60">
          Use the category tabs to browse. Add items to cart, then place your order.
        </p>
      </div>

      <MenuClient
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        items={items.map((i) => ({
          id: i.id,
          categoryId: i.categoryId,
          name: i.name,
          description: i.description,
          ingredients: i.ingredients,
          price: i.price,
          isOutOfStock: i.isOutOfStock
        }))}
      />
    </main>
  );
}

