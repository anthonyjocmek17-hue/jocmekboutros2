"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");
  return session;
}

const CreateItemSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(300).optional().or(z.literal("")),
  ingredients: z.string().max(800).optional().or(z.literal("")),
  price: z.string().max(40).optional().or(z.literal("")),
  prepTimeMinutes: z.coerce.number().int().min(0).max(240).default(10),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0)
});

export async function createItem(formData: FormData) {
  await requireAdmin();
  const parsed = CreateItemSchema.safeParse({
    categoryId: formData.get("categoryId"),
    name: formData.get("name"),
    description: formData.get("description"),
    ingredients: formData.get("ingredients"),
    price: formData.get("price"),
    prepTimeMinutes: formData.get("prepTimeMinutes"),
    sortOrder: formData.get("sortOrder")
  });
  if (!parsed.success) throw new Error("Invalid input");

  await db.menuItem.create({
    data: {
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      ingredients: parsed.data.ingredients || null,
      price: parsed.data.price || null,
      prepTimeMinutes: parsed.data.prepTimeMinutes,
      sortOrder: parsed.data.sortOrder
    }
  });
  revalidatePath("/admin/items");
  revalidatePath("/");
}

export async function toggleItemAvailability(itemId: string) {
  await requireAdmin();
  const item = await db.menuItem.findUnique({ where: { id: itemId } });
  if (!item) return;
  await db.menuItem.update({ where: { id: itemId }, data: { isAvailable: !item.isAvailable } });
  revalidatePath("/admin/items");
  revalidatePath("/");
}

export async function deleteItem(itemId: string) {
  await requireAdmin();
  await db.menuItem.delete({ where: { id: itemId } });
  revalidatePath("/admin/items");
  revalidatePath("/");
}

export async function toggleOutOfStock(itemId: string) {
  await requireAdmin();
  const item = await db.menuItem.findUnique({ where: { id: itemId } });
  if (!item) return;
  await db.menuItem.update({ where: { id: itemId }, data: { isOutOfStock: !item.isOutOfStock } });
  revalidatePath("/admin/items");
  revalidatePath("/");
}

export async function setPrepTime(itemId: string, minutes: number) {
  await requireAdmin();
  const m = Math.max(0, Math.min(240, Math.trunc(minutes)));
  await db.menuItem.update({ where: { id: itemId }, data: { prepTimeMinutes: m } });
  revalidatePath("/admin/items");
  revalidatePath("/");
}

const UpdateItemMetaSchema = z.object({
  itemId: z.string().min(1),
  description: z.string().max(300).optional().or(z.literal("")),
  ingredients: z.string().max(800).optional().or(z.literal(""))
});

export async function updateItemMeta(formData: FormData) {
  await requireAdmin();
  const parsed = UpdateItemMetaSchema.safeParse({
    itemId: formData.get("itemId"),
    description: formData.get("description"),
    ingredients: formData.get("ingredients")
  });
  if (!parsed.success) throw new Error("Invalid input");

  await db.menuItem.update({
    where: { id: parsed.data.itemId },
    data: {
      description: parsed.data.description || null,
      ingredients: parsed.data.ingredients || null
    }
  });
  revalidatePath("/admin/items");
  revalidatePath("/");
}

