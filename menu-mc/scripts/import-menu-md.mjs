import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function parseMenuMd(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");

  const categories = [];
  let current = null;
  let pendingItem = null;

  function flushPending() {
    if (pendingItem && current) {
      current.items.push(pendingItem);
    }
    pendingItem = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();

    const h2 = /^\s*##\s+(.+?)\s*$/.exec(line);
    if (h2) {
      flushPending();
      const name = h2[1].trim();
      current = { name, items: [] };
      categories.push(current);
      continue;
    }

    if (!current) continue;

    // ignore notes under categories (kept in markdown, not stored in DB)
    if (/^\s*\*\*note:\*\*/i.test(line)) continue;

    // item line: - **Name** — **$4.5**
    const item = /^\s*-\s+\*\*(.+?)\*\*\s+—\s+\*\*\$?([0-9]+(?:\.[0-9]+)?)\*\*/.exec(line);
    if (item) {
      flushPending();
      pendingItem = {
        name: item[1].trim(),
        price: `$${item[2]}`,
        ingredients: ""
      };
      continue;
    }

    // ingredients continuation line usually starts with two spaces in the md
    if (pendingItem && /^\s{2,}\S/.test(raw)) {
      const ing = raw.trim();
      pendingItem.ingredients = pendingItem.ingredients ? `${pendingItem.ingredients} ${ing}` : ing;
      continue;
    }

    // blank line ends the current pending item paragraph
    if (pendingItem && line.trim() === "") {
      flushPending();
      continue;
    }
  }

  flushPending();
  return categories;
}

async function main() {
  const inputPath = process.argv[2] || path.join(process.cwd(), "menu-source", "menu.md");
  const md = await fs.readFile(inputPath, "utf8");
  const parsed = parseMenuMd(md);

  if (!parsed.length) {
    console.error("No categories parsed from menu markdown.");
    process.exitCode = 1;
    return;
  }

  // Wipe existing menu (items then categories). Orders keep line snapshots.
  await db.menuItem.deleteMany({});
  await db.category.deleteMany({});

  for (let cIdx = 0; cIdx < parsed.length; cIdx++) {
    const c = parsed[cIdx];
    const category = await db.category.create({
      data: {
        name: c.name,
        sortOrder: cIdx
      }
    });

    for (let i = 0; i < c.items.length; i++) {
      const it = c.items[i];
      const description = it.ingredients ? `Ingredients: ${it.ingredients}` : null;
      await db.menuItem.create({
        data: {
          categoryId: category.id,
          name: it.name,
          description,
          price: it.price,
          sortOrder: i,
          prepTimeMinutes: 10,
          isAvailable: true,
          isOutOfStock: false
        }
      });
    }
  }

  console.log(`Imported ${parsed.length} categories from ${inputPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });

