import type { Voucher } from "@prisma/client";

export function computeVoucherDiscountCents(totalCents: number, voucher: Voucher | null): number {
  if (!voucher) return 0;
  if (!voucher.isActive) return 0;
  if (voucher.expiresAt && voucher.expiresAt.getTime() < Date.now()) return 0;
  if (voucher.maxUses !== null && voucher.maxUses !== undefined && voucher.usesCount >= voucher.maxUses) return 0;

  if (voucher.type === "AMOUNT") {
    const amt = voucher.amountCents ?? 0;
    return Math.max(0, Math.min(totalCents, amt));
  }

  const pct = voucher.percent ?? 0;
  const p = Math.max(0, Math.min(100, pct));
  return Math.max(0, Math.min(totalCents, Math.round((totalCents * p) / 100)));
}

export function clampManualDiscountCents(remainingCents: number, manualDiscountCents: number): number {
  const d = Math.trunc(manualDiscountCents);
  return Math.max(0, Math.min(remainingCents, d));
}

