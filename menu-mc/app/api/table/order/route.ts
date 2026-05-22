import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

/** Open kitchen / delivery lifecycle: show until kitchen marks COMPLETED (or order cancelled). */
const TABLE_OPEN_STATUSES = ["NEW", "IN_PROGRESS", "READY"] as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if ((session as any).role !== "TABLE") return new NextResponse("Forbidden", { status: 403 });

  const userId = (session as any).userId as string;
  const orders = await db.order.findMany({
    where: { userId, status: { in: [...TABLE_OPEN_STATUSES] } },
    orderBy: { createdAt: "asc" },
    include: { items: true, table: true }
  });

  return NextResponse.json({ orders });
}
