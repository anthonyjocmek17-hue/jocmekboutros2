"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { adminOrdersReturnUrl } from "./nav";
import { clampManualDiscountCents, computeVoucherDiscountCents } from "@/lib/discounts";
import { parsePriceToCents } from "@/lib/money";
import { persistEstimateForOrder, recomputeAllActiveEstimates } from "@/lib/eta";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");
  const role = (session as any).role as string;
  if (role !== "ADMIN") throw new Error("Forbidden");
  return session;
}

export async function deleteOrder(formData: FormData) {
  await requireAdmin();
  const orderId = String(formData.get("orderId") || "");
  if (!orderId) throw new Error("Invalid order");
  await db.order.delete({ where: { id: orderId } });
  revalidatePath("/admin/orders");
  revalidatePath("/waiter");
  revalidatePath("/kitchen");
}

const UpdateSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(["NEW", "IN_PROGRESS", "READY", "COMPLETED", "CANCELLED"]).optional(),
  note: z.string().max(300).optional().or(z.literal("")),
  isPaid: z.coerce.boolean().optional()
});

export async function updateOrder(formData: FormData) {
  await requireAdmin();
  const parsed = UpdateSchema.safeParse({
    orderId: formData.get("orderId"),
    status: formData.get("status") ?? undefined,
    note: formData.get("note") ?? undefined,
    isPaid: formData.get("isPaid") ?? undefined
  });
  if (!parsed.success) throw new Error("Invalid input");

  const data: any = {};
  if (parsed.data.status) {
    data.status = parsed.data.status as any;
    data.startedAt = parsed.data.status === "IN_PROGRESS" ? new Date() : undefined;
    data.readyAt = parsed.data.status === "READY" ? new Date() : undefined;
    data.completedAt = parsed.data.status === "COMPLETED" ? new Date() : undefined;
  }
  if (parsed.data.note !== undefined) data.note = parsed.data.note || null;
  if (parsed.data.isPaid !== undefined) {
    data.isPaid = parsed.data.isPaid;
    data.paidAt = parsed.data.isPaid ? new Date() : null;
  }

  await db.order.update({ where: { id: parsed.data.orderId }, data });
  if (parsed.data.status) {
    await recomputeAllActiveEstimates();
  }
  revalidatePath("/admin/orders");
  revalidatePath("/waiter");
  revalidatePath("/kitchen");
  revalidatePath("/order");
  redirect(adminOrdersReturnUrl(parsed.data.orderId, "meta"));
}

/** Voucher + manual discount only — does not change custom final price. */
export async function saveBillDiscounts(formData: FormData) {
  await requireAdmin();
  const orderId = String(formData.get("orderId") ?? "").trim();
  if (!orderId) throw new Error("Missing order");

  const existing = await db.order.findUnique({ where: { id: orderId } });
  if (!existing) throw new Error("Order not found");

  const vRaw = formData.get("voucherCode");
  const voucherCode = String(vRaw ?? "").trim().toUpperCase() || null;

  // Read dollars directly from FormData (Zod + optional() was dropping / rejecting some payloads).
  let manualDiscountCents: number;
  if (!formData.has("manualDiscount")) {
    manualDiscountCents = existing.manualDiscountCents ?? 0;
  } else {
    const mRaw = formData.get("manualDiscount");
    manualDiscountCents = parsePriceToCents(typeof mRaw === "string" ? mRaw : String(mRaw ?? ""));
  }

  await db.order.update({
    where: { id: orderId },
    data: {
      voucherCode,
      manualDiscountCents
    }
  });
  await recomputeOrderTotals(orderId);
  revalidatePath("/admin/orders");
  revalidatePath("/waiter");
  revalidatePath("/kitchen");
  revalidatePath("/order");
  redirect(adminOrdersReturnUrl(orderId, "discounts"));
}

/** Custom final (or clear it) only — does not change voucher or manual discount fields. */
export async function saveBillFinal(formData: FormData) {
  await requireAdmin();
  const orderId = String(formData.get("orderId") ?? "").trim();
  if (!orderId) throw new Error("Missing order");

  let finalTotalOverrideCents: number | null;
  if (!formData.has("finalPriceOverride")) {
    const ex = await db.order.findUnique({ where: { id: orderId }, select: { finalTotalOverrideCents: true } });
    finalTotalOverrideCents = ex?.finalTotalOverrideCents ?? null;
  } else {
    const s = String(formData.get("finalPriceOverride") ?? "").trim();
    finalTotalOverrideCents = s === "" ? null : parsePriceToCents(s);
  }

  await db.order.update({
    where: { id: orderId },
    data: { finalTotalOverrideCents }
  });
  await recomputeOrderTotals(orderId);
  revalidatePath("/admin/orders");
  revalidatePath("/waiter");
  revalidatePath("/kitchen");
  revalidatePath("/order");
  redirect(adminOrdersReturnUrl(orderId, "final"));
}

async function recomputeOrderTotals(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true }
  });
  if (!order) return;

  const totalCents = order.items.reduce((sum, it) => sum + parsePriceToCents(it.price) * it.quantity, 0);

  const voucherCode = order.voucherCode;
  const voucher = voucherCode ? await db.voucher.findUnique({ where: { code: voucherCode } }) : null;
  const voucherDiscountCents = computeVoucherDiscountCents(totalCents, voucher);
  const remainingAfterVoucher = Math.max(0, totalCents - voucherDiscountCents);
  const manualDiscountCents = clampManualDiscountCents(remainingAfterVoucher, order.manualDiscountCents ?? 0);
  const computedFinalCents = Math.max(0, totalCents - voucherDiscountCents - manualDiscountCents);
  const finalTotalCents =
    order.finalTotalOverrideCents != null
      ? Math.max(0, order.finalTotalOverrideCents)
      : computedFinalCents;

  await db.order.update({
    where: { id: orderId },
    data: {
      totalCents,
      voucherDiscountCents,
      manualDiscountCents,
      finalTotalCents
    }
  });

  await persistEstimateForOrder(orderId);
}

const UpdateLineSchema = z.object({
  orderId: z.string().min(1),
  itemId: z.string().min(1),
  name: z.string().min(1).max(120),
  price: z.string().max(40).optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(1).max(99)
});

export async function updateOrderLine(formData: FormData) {
  await requireAdmin();
  const parsed = UpdateLineSchema.safeParse({
    orderId: formData.get("orderId"),
    itemId: formData.get("itemId"),
    name: formData.get("name"),
    price: formData.get("price"),
    quantity: formData.get("quantity")
  });
  if (!parsed.success) throw new Error("Invalid line");

  const updated = await db.orderItem.updateMany({
    where: { id: parsed.data.itemId, orderId: parsed.data.orderId },
    data: {
      name: parsed.data.name,
      price: parsed.data.price || null,
      quantity: parsed.data.quantity
    }
  });
  if (updated.count === 0) throw new Error("Line not found");

  await recomputeOrderTotals(parsed.data.orderId);
  revalidatePath("/admin/orders");
  revalidatePath("/waiter");
  revalidatePath("/kitchen");
  redirect(adminOrdersReturnUrl(parsed.data.orderId, "lines", { row: parsed.data.itemId }));
}

export async function deleteOrderLine(formData: FormData) {
  await requireAdmin();
  const orderId = String(formData.get("orderId") || "");
  const itemId = String(formData.get("itemId") || "");
  if (!orderId || !itemId) throw new Error("Invalid");

  const deleted = await db.orderItem.deleteMany({ where: { id: itemId, orderId } });
  if (deleted.count === 0) throw new Error("Line not found");
  await recomputeOrderTotals(orderId);
  revalidatePath("/admin/orders");
  revalidatePath("/waiter");
  revalidatePath("/kitchen");
  redirect(adminOrdersReturnUrl(orderId, "lines"));
}

const AddLineSchema = z.object({
  orderId: z.string().min(1),
  name: z.string().min(1).max(120),
  price: z.string().max(40).optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(1).max(99).default(1)
});

export async function addOrderLine(formData: FormData) {
  await requireAdmin();
  const parsed = AddLineSchema.safeParse({
    orderId: formData.get("orderId"),
    name: formData.get("name"),
    price: formData.get("price"),
    quantity: formData.get("quantity")
  });
  if (!parsed.success) throw new Error("Invalid line");

  await db.orderItem.create({
    data: {
      orderId: parsed.data.orderId,
      menuItemId: null,
      name: parsed.data.name,
      price: parsed.data.price || null,
      quantity: parsed.data.quantity
    }
  });

  await recomputeOrderTotals(parsed.data.orderId);
  revalidatePath("/admin/orders");
  revalidatePath("/waiter");
  revalidatePath("/kitchen");
  redirect(adminOrdersReturnUrl(parsed.data.orderId, "add"));
}

