export function parsePriceToCents(price: string | null | undefined): number {
  if (!price) return 0;
  // Accept inputs like "$9.99", "9.99", "9", "€ 12,50" (best-effort)
  const normalized = price
    .trim()
    .replace(",", ".")
    .replace(/[^0-9.]/g, "");
  if (!normalized) return 0;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 100));
}

export function formatCentsUSD(cents: number): string {
  const v = (cents / 100).toFixed(2);
  return `$${v}`;
}

export function formatCentsAsDollarInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

