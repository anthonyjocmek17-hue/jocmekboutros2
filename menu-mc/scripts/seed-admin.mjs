import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const email = process.env.SEED_ADMIN_EMAIL || "admin@menu.local";
const password = process.env.SEED_ADMIN_PASSWORD || "admin12345";
const kitchenEmail = process.env.SEED_KITCHEN_EMAIL || "kitchen@menu.local";
const kitchenPassword = process.env.SEED_KITCHEN_PASSWORD || "kitchen12345";
const waiterEmail = process.env.SEED_WAITER_EMAIL || "waiter@menu.local";
const waiterPassword = process.env.SEED_WAITER_PASSWORD || "waiter12345";

/** `Table 1` … `Table N` plus `tableN@menu.local` (default 13). Override with `SEED_TABLE_COUNT=10`, etc. */
const tableCount = Math.min(99, Math.max(1, parseInt(process.env.SEED_TABLE_COUNT || "13", 10)));

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);
  await db.user.upsert({
    where: { email },
    update: { passwordHash, role: "ADMIN" },
    create: { email, passwordHash, role: "ADMIN" }
  });

  const kitchenHash = await bcrypt.hash(kitchenPassword, 12);
  await db.user.upsert({
    where: { email: kitchenEmail },
    update: { passwordHash: kitchenHash, role: "KITCHEN", tableId: null },
    create: { email: kitchenEmail, passwordHash: kitchenHash, role: "KITCHEN", tableId: null }
  });

  const waiterHash = await bcrypt.hash(waiterPassword, 12);
  await db.user.upsert({
    where: { email: waiterEmail },
    update: { passwordHash: waiterHash, role: "WAITER", tableId: null },
    create: { email: waiterEmail, passwordHash: waiterHash, role: "WAITER", tableId: null }
  });

  // Seed table accounts: table1@menu.local … (password: table12345). Count from SEED_TABLE_COUNT (default 13).
  const tablePassword = process.env.SEED_TABLE_PASSWORD || "table12345";
  const tableHash = await bcrypt.hash(tablePassword, 12);
  for (let i = 1; i <= tableCount; i++) {
    const label = `Table ${i}`;
    const table = await db.table.upsert({
      where: { label },
      update: {},
      create: { label }
    });
    const tableEmail = `table${i}@menu.local`;
    await db.user.upsert({
      where: { email: tableEmail },
      update: { passwordHash: tableHash, role: "TABLE", tableId: table.id },
      create: { email: tableEmail, passwordHash: tableHash, role: "TABLE", tableId: table.id }
    });
  }

  const existingCats = await db.category.count();
  if (existingCats === 0) {
    const burgers = await db.category.create({ data: { name: "Burgers", sortOrder: 0 } });
    const wraps = await db.category.create({ data: { name: "Wraps", sortOrder: 1 } });
    const sides = await db.category.create({ data: { name: "Sides", sortOrder: 2 } });

    await db.menuItem.createMany({
      data: [
        { categoryId: burgers.id, name: "Classic Burger", description: "Lettuce, tomato, house sauce", price: "$9.99", sortOrder: 0 },
        { categoryId: burgers.id, name: "Cheese Burger", description: "Cheddar, pickles, onion", price: "$10.99", sortOrder: 1 },
        { categoryId: wraps.id, name: "Chicken Wrap", description: "Grilled chicken, salad, garlic sauce", price: "$8.99", sortOrder: 0 },
        { categoryId: sides.id, name: "Fries", description: "Crispy golden fries", price: "$3.49", sortOrder: 0 }
      ]
    });
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });

