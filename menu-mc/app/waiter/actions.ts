"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

async function requireWaiter() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");
  const role = (session as any).role as string;
  if (role !== "WAITER" && role !== "ADMIN") throw new Error("Forbidden");
  return session;
}

function toBool(v: unknown) {
  if (v === true || v === 1 || v === "1" || v === "true" || v === "on") return true;
  if (v === false || v === 0 || v === "0" || v === "false" || v === "off") return false;
  return v;
}

const SetPaidSchema = z.object({
  orderId: z.string().min(1),
  isPaid: z.preprocess(toBool, z.boolean()),
  returnTo: z.string().optional()
});

export async function setOrderPaid(formData: FormData) {
  await requireWaiter();
  const parsed = SetPaidSchema.safeParse({
    orderId: formData.get("orderId"),
    isPaid: formData.get("isPaid"),
    returnTo: formData.get("returnTo")
  });
  if (!parsed.success) throw new Error("Invalid");

  await db.order.update({
    where: { id: parsed.data.orderId },
    data: { isPaid: parsed.data.isPaid, paidAt: parsed.data.isPaid ? new Date() : null }
  });

  revalidatePath("/waiter");
  revalidatePath("/admin/orders");
  const returnTo = parsed.data.returnTo?.startsWith("/waiter") ? parsed.data.returnTo : "/waiter";
  redirect(returnTo);
}

const SetDeliveredSchema = z.object({
  orderId: z.string().min(1),
  delivered: z.preprocess(toBool, z.boolean()),
  returnTo: z.string().optional()
});

export async function setOrderDelivered(formData: FormData) {
  await requireWaiter();
  const parsed = SetDeliveredSchema.safeParse({
    orderId: formData.get("orderId"),
    delivered: formData.get("delivered"),
    returnTo: formData.get("returnTo")
  });
  if (!parsed.success) throw new Error("Invalid");

  const order = await db.order.findUnique({ where: { id: parsed.data.orderId } });
  if (!order) throw new Error("Order not found");

  if (parsed.data.delivered) {
    const data: {
      deliveredAt: Date;
      status?: "COMPLETED";
      completedAt?: Date;
    } = { deliveredAt: new Date() };
    // Kitchen "Ready" — once the waiter delivers, show as complete on the kitchen board.
    if (order.status === "READY") {
      data.status = "COMPLETED";
      data.completedAt = new Date();
    }
    await db.order.update({ where: { id: order.id }, data });
  } else {
    await db.order.update({
      where: { id: order.id },
      data: { deliveredAt: null }
    });
  }

  revalidatePath("/waiter");
  revalidatePath("/admin/orders");
  revalidatePath("/kitchen");
  const returnTo = parsed.data.returnTo?.startsWith("/waiter") ? parsed.data.returnTo : "/waiter";
  redirect(returnTo);
}

