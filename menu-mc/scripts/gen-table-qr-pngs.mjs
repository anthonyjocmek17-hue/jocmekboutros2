/**
 * Writes one PNG QR per row in the `Table` model (auto-login URLs).
 * Output: public/qr-tables/table-<n>-login-qr.png (from label "Table N").
 *
 *   npm run qr:png              — uses .env (DATABASE_URL, NEXTAUTH_SECRET or TABLE_QR_SECRET, NEXTAUTH_URL)
 *   npm run qr:png:example      — same but forces NEXTAUTH_SECRET + NEXTAUTH_URL to .env.example defaults
 *
 * Run `npm run seed` first so tables (and TABLE users) exist. Regenerate after changing secrets or NEXTAUTH_URL.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import QRCode from "qrcode";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadDotEnv() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function signTableQrToken(tableLabel, ttlMs, secret) {
  const payload = { v: 1, l: tableLabel, exp: Date.now() + ttlMs };
  const pB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(pB64).digest("base64url");
  return `${pB64}.${sig}`;
}

/** "Table 7" -> "table-7-login-qr" ; other labels -> slug */
function fileBaseFromLabel(label) {
  const m = /^Table\s+(\d+)$/i.exec(label.trim());
  if (m) return `table-${m[1]}-login-qr`;
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `table-${slug || "unknown"}-login-qr`;
}

function sortTablesByNumber(tables) {
  return [...tables].sort((a, b) => {
    const na = parseInt(/^Table\s+(\d+)$/i.exec(a.label)?.[1] ?? "", 10);
    const nb = parseInt(/^Table\s+(\d+)$/i.exec(b.label)?.[1] ?? "", 10);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.label.localeCompare(b.label);
  });
}

const useExample = process.argv.includes("--example");
loadDotEnv();
if (useExample) {
  process.env.NEXTAUTH_SECRET = "change-me-in-production";
  process.env.NEXTAUTH_URL = "http://localhost:3000";
  console.warn("[qr] --example: forcing NEXTAUTH_SECRET + NEXTAUTH_URL to .env.example defaults.");
}

const secret = (process.env.TABLE_QR_SECRET || process.env.NEXTAUTH_SECRET || "").trim();
if (!secret) {
  console.error("Missing TABLE_QR_SECRET or NEXTAUTH_SECRET. Or run: npm run qr:png:example");
  process.exit(1);
}

const base = (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
const ttlMs = 365 * 24 * 60 * 60 * 1000;

const db = new PrismaClient();
let tables;
try {
  tables = sortTablesByNumber(await db.table.findMany({ select: { label: true } }));
} catch (e) {
  console.error("Could not read tables from the database. Is DATABASE_URL set and migrations applied?", e);
  process.exit(1);
} finally {
  await db.$disconnect();
}

if (tables.length === 0) {
  console.error("No tables in the database. Run: npm run seed");
  process.exit(1);
}

const outDir = path.join(root, "public", "qr-tables");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const written = [];
for (const { label } of tables) {
  const token = signTableQrToken(label, ttlMs, secret);
  const loginUrl = `${base}/login/table?t=${encodeURIComponent(token)}`;
  const baseName = fileBaseFromLabel(label);
  const outFile = path.join(outDir, `${baseName}.png`);
  await QRCode.toFile(outFile, loginUrl, {
    type: "png",
    width: 512,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#000000ff", light: "#ffffffff" },
  });
  written.push({ label, file: path.relative(root, outFile) });
}

console.log(`Wrote ${written.length} QR PNG(s) under public/qr-tables/`);
for (const w of written) console.log(`  ${w.label} → ${w.file}`);
