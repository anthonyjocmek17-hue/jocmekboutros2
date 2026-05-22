import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { recomputeAllActiveEstimates } from "@/lib/eta";

async function requireKitchen() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const role = (session as any).role as string;
  if (role !== "KITCHEN" && role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  const session = await requireKitchen();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const orders = await db.order.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: 50,
    include: { table: true, items: true }
  });

  return NextResponse.json({ orders });
}

const PatchSchema = z.object({
  id: z.string().min(1),
  next: z.enum(["NEW", "IN_PROGRESS", "READY", "COMPLETED", "CANCELLED"])
});

export async function PATCH(req: Request) {
  const session = await requireKitchen();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) return new NextResponse("Invalid payload", { status: 400 });

  const next = parsed.data.next as any;
  await db.order.update({
    where: { id: parsed.data.id },
    data: {
      status: next,
      startedAt: next === "IN_PROGRESS" ? new Date() : undefined,
      readyAt: next === "READY" ? new Date() : undefined,
      completedAt: next === "COMPLETED" ? new Date() : undefined
    }
  });

  await recomputeAllActiveEstimates();

  return NextResponse.json({ ok: true });
}

