import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { parsePriceToCents } from "@/lib/money";
import { clampManualDiscountCents, computeVoucherDiscountCents } from "@/lib/discounts";
import { ETA, estimateReadyAtForNewOrder } from "@/lib/eta";

const CreateManualOrderSchema = z.object({
  tableId: z.string().min(1),
  note: z.string().max(300).optional().or(z.literal("")),
  voucherCode: z.string().max(40).optional().or(z.literal("")),
  // dollars (e.g. "5.25" or 5.25) — converted server-side to cents
  manualDiscount: z.union([z.string(), z.number()]).optional(),
  lines: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z.number().int().min(1).max(99)
      })
    )
    .min(1)
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session as any).role as string;
  if (role !== "WAITER" && role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = CreateManualOrderSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const table = await db.table.findUnique({ where: { id: parsed.data.tableId } });
  if (!table) return NextResponse.json({ error: "Unknown table" }, { status: 400 });

  const menuItems = await db.menuItem.findMany({
    where: { id: { in: parsed.data.lines.map((l) => l.menuItemId) }, isAvailable: true, isOutOfStock: false }
  });
  const byId = new Map(menuItems.map((m) => [m.id, m]));
  for (const l of parsed.data.lines) {
    if (!byId.has(l.menuItemId)) return NextResponse.json({ error: "One or more items are unavailable" }, { status: 400 });
  }

  const ownPrepMinutes = parsed.data.lines.reduce((sum, l) => {
    const m = byId.get(l.menuItemId)!;
    return sum + (m.prepTimeMinutes || ETA.DEFAULT_PREP_MINUTES) * l.quantity;
  }, 0);
  const estimatedReadyAt = await estimateReadyAtForNewOrder({ ownPrepMinutes });

  const totalCents = parsed.data.lines.reduce((sum, l) => {
    const m = byId.get(l.menuItemId)!;
    return sum + parsePriceToCents(m.price) * l.quantity;
  }, 0);

  const voucherCode = (parsed.data.voucherCode || "").trim().toUpperCase() || null;
  const voucher = voucherCode ? await db.voucher.findUnique({ where: { code: voucherCode } }) : null;
  const voucherDiscountCents = computeVoucherDiscountCents(totalCents, voucher);
  const remainingAfterVoucher = Math.max(0, totalCents - voucherDiscountCents);
  const manualDiscountCents = clampManualDiscountCents(
    remainingAfterVoucher,
    parsePriceToCents(parsed.data.manualDiscount !== undefined ? String(parsed.data.manualDiscount) : "0")
  );
  const finalTotalCents = Math.max(0, totalCents - voucherDiscountCents - manualDiscountCents);

  const order = await db.order.create({
    data: {
      tableId: parsed.data.tableId,
      userId: (session as any).userId as string,
      note: parsed.data.note || null,
      estimatedReadyAt,
      totalCents,
      voucherCode,
      voucherDiscountCents,
      manualDiscountCents,
      finalTotalCents,
      items: {
        create: parsed.data.lines.map((l) => {
          const m = byId.get(l.menuItemId)!;
          return { menuItemId: m.id, name: m.name, price: m.price, quantity: l.quantity };
        })
      }
    }
  });

  if (voucher && voucherCode && voucherDiscountCents > 0) {
    try {
      await db.voucher.update({ where: { code: voucherCode }, data: { usesCount: { increment: 1 } } });
    } catch {}
  }

  return NextResponse.json({ id: order.id });
}

