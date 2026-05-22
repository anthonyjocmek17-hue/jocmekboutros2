import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { renderLoginUrlQrPngBuffer } from "@/lib/renderTableQrPng";
import { signTableQrToken } from "@/lib/tableQrToken";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session as { role?: string }).role !== "ADMIN") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let token: string;
  try {
    token = signTableQrToken("Table 1", 365 * 24 * 60 * 60 * 1000);
  } catch {
    return new NextResponse("Missing TABLE_QR_SECRET or NEXTAUTH_SECRET", { status: 500 });
  }

  const hdrs = await headers();
  const base =
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    `${hdrs.get("x-forwarded-proto") ?? "http"}://${hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000"}`;

  const loginUrl = `${base}/login/table?t=${encodeURIComponent(token)}`;
  const download = request.nextUrl.searchParams.get("download") === "1";
  const width = download ? 512 : 280;

  let buf: Buffer;
  try {
    buf = await renderLoginUrlQrPngBuffer(loginUrl, width);
  } catch {
    return new NextResponse("Failed to render QR image", { status: 500 });
  }

  const disposition = download
    ? 'attachment; filename="table-1-qr.png"'
    : 'inline; filename="table-1-qr.png"';

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": disposition,
      "Cache-Control": "private, no-store",
    },
  });
}
