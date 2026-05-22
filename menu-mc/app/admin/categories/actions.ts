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

const CreateCategorySchema = z.object({
  name: z.string().min(1).max(80),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0)
});

export async function createCategory(formData: FormData) {
  await requireAdmin();
  const parsed = CreateCategorySchema.safeParse({
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder")
  });
  if (!parsed.success) throw new Error("Invalid input");

  await db.category.create({ data: parsed.data });
  revalidatePath("/admin/categories");
  revalidatePath("/");
}

export async function deleteCategory(categoryId: string) {
  await requireAdmin();
  await db.category.delete({ where: { id: categoryId } });
  revalidatePath("/admin/categories");
  revalidatePath("/");
}

