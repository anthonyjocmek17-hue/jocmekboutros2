type BillPart = "meta" | "discounts" | "final" | "lines" | "add";

/** Return-to-bill URL after saving on /admin/orders (used by server actions). */
export function adminOrdersReturnUrl(orderId: string, part: BillPart, opts?: { row?: string }): string {
  let u = `/admin/orders?bill=${encodeURIComponent(orderId)}&part=${encodeURIComponent(part)}`;
  if (opts?.row) u += `&row=${encodeURIComponent(opts.row)}`;
  return u;
}
