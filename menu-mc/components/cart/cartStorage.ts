import type { CartState } from "./cartTypes";

const KEY = "menu-mc.cart.v1";

export function loadCart(): CartState {
  if (typeof window === "undefined") return { lines: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { lines: [] };
    const parsed = JSON.parse(raw) as CartState;
    if (!parsed?.lines?.length) return { lines: [] };
    return { lines: parsed.lines.filter((l) => l && l.menuItemId && l.quantity > 0) };
  } catch {
    return { lines: [] };
  }
}

export function saveCart(state: CartState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(state));
}

