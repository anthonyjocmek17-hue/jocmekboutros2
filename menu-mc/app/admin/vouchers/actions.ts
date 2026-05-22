"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { parsePriceToCents } from "@/lib/money";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");
  const role = (session as any).role as string;
  if (role !== "ADMIN") throw new Error("Forbidden");
  return session;
}

const CreateSchema = z.object({
  code: z.string().min(3).max(40),
  type: z.enum(["AMOUNT", "PERCENT"]),
  amountDollars: z.string().optional().or(z.literal("")),
  percent: z.coerce.number().int().min(1).max(100).optional()
});

export async function createVoucher(formData: FormData) {
  await requireAdmin();
  const parsed = CreateSchema.safeParse({
    code: String(formData.get("code") || "").trim().toUpperCase(),
    type: formData.get("type"),
    amountDollars: String(formData.get("amountDollars") || ""),
    percent: formData.get("percent")
  });
  if (!parsed.success) throw new Error("Invalid input");

  await db.voucher.create({
    data: {
      code: parsed.data.code,
      type: parsed.data.type as any,
      amountCents: parsed.data.type === "AMOUNT" ? parsePriceToCents(parsed.data.amountDollars || "0") : null,
      percent: parsed.data.type === "PERCENT" ? (parsed.data.percent ?? 10) : null
    }
  });
  revalidatePath("/admin/vouchers");
}

export async function toggleVoucherActive(code: string) {
  await requireAdmin();
  const v = await db.voucher.findUnique({ where: { code } });
  if (!v) return;
  await db.voucher.update({ where: { code }, data: { isActive: !v.isActive } });
  revalidatePath("/admin/vouchers");
}

export async function deleteVoucher(code: string) {
  await requireAdmin();
  await db.voucher.delete({ where: { code } });
  revalidatePath("/admin/vouchers");
}

