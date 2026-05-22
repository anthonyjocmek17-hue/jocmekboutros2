import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { parsePriceToCents } from "@/lib/money";
import { computeVoucherDiscountCents } from "@/lib/discounts";
import { ETA, estimateReadyAtForNewOrder } from "@/lib/eta";

const CreateOrderSchema = z.object({
  note: z.string().max(300).optional().or(z.literal("")),
  voucherCode: z.string().max(40).optional().or(z.literal("")),
  lines: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        name: z.string().min(1),
        price: z.string().max(40).nullable(),
        quantity: z.number().int().min(1).max(99)
      })
    )
    .min(1)
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((session as any).role !== "TABLE")
      return NextResponse.json({ error: "Only tables can place orders" }, { status: 403 });
    const tableId = (session as any).tableId as string | null;
    if (!tableId) return NextResponse.json({ error: "No table assigned to this login" }, { status: 400 });

    const json = await req.json().catch(() => null);
    const parsed = CreateOrderSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

    // Validate menu items exist + still available (avoid spoofing).
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
    const manualDiscountCents = 0;
    const finalTotalCents = Math.max(0, totalCents - voucherDiscountCents - manualDiscountCents);

    const order = await db.order.create({
      data: {
        tableId,
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
            return {
              menuItemId: m.id,
              name: m.name,
              price: m.price,
              quantity: l.quantity
            };
          })
        }
      }
    });

    // Best-effort: increment voucher usage (don’t block order if this fails).
    if (voucher && voucherCode && voucherDiscountCents > 0) {
      try {
        await db.voucher.update({ where: { code: voucherCode }, data: { usesCount: { increment: 1 } } });
      } catch {}
    }

    return NextResponse.json({ id: order.id });
  } catch (e: any) {
    // Most common cause: Prisma/SQLite schema not migrated after new fields were added.
    return NextResponse.json(
      { error: `Server error creating order. If you recently updated the schema, run prisma migrate. (${e?.message ?? "unknown"})` },
      { status: 500 }
    );
  }
}

