import crypto from "crypto";

export type TableQrPayload = {
  v: 1;
  /** Must match `Table.label` in the database (e.g. "Table 1"). */
  l: string;
  exp: number;
};

function getSecret(): string | null {
  const s = process.env.TABLE_QR_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  return s || null;
}

/** Signed token: base64url(payloadJson).base64url(hmacSha256(secret, payloadPart)) */
export function signTableQrToken(tableLabel: string, ttlMs: number): string {
  const secret = getSecret();
  if (!secret) throw new Error("Missing TABLE_QR_SECRET or NEXTAUTH_SECRET for table QR signing.");

  const payload: TableQrPayload = {
    v: 1,
    l: tableLabel,
    exp: Date.now() + ttlMs
  };
  const pB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(pB64).digest("base64url");
  return `${pB64}.${sig}`;
}

export function verifyTableQrToken(token: string): TableQrPayload | null {
  const secret = getSecret();
  if (!secret) return null;

  const dot = token.indexOf(".");
  if (dot < 1) return null;
  const pB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!pB64 || !sig) return null;

  const expected = crypto.createHmac("sha256", secret).update(pB64).digest("base64url");
  try {
    const a = Buffer.from(sig, "base64url");
    const b = Buffer.from(expected, "base64url");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(pB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<TableQrPayload>;
  if (o.v !== 1 || typeof o.l !== "string" || typeof o.exp !== "number") return null;
  if (o.exp < Date.now()) return null;
  return { v: 1, l: o.l, exp: o.exp };
}
