"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CartLine, CartState } from "./cartTypes";
import { loadCart, saveCart } from "./cartStorage";

type CartContextValue = {
  state: CartState;
  totalItems: number;
  addLine: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  setQuantity: (menuItemId: string, quantity: number) => void;
  removeLine: (menuItemId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CartState>({ lines: [] });

  useEffect(() => {
    setState(loadCart());
  }, []);

  useEffect(() => {
    saveCart(state);
  }, [state]);

  const value = useMemo<CartContextValue>(() => {
    const totalItems = state.lines.reduce((sum, l) => sum + l.quantity, 0);

    return {
      state,
      totalItems,
      addLine: (line, quantity = 1) => {
        setState((prev) => {
          const existing = prev.lines.find((l) => l.menuItemId === line.menuItemId);
          if (existing) {
            return {
              lines: prev.lines.map((l) =>
                l.menuItemId === line.menuItemId ? { ...l, quantity: l.quantity + quantity } : l
              )
            };
          }
          return { lines: [...prev.lines, { ...line, quantity }] };
        });
      },
      setQuantity: (menuItemId, quantity) => {
        setState((prev) => ({
          lines: prev.lines
            .map((l) => (l.menuItemId === menuItemId ? { ...l, quantity } : l))
            .filter((l) => l.quantity > 0)
        }));
      },
      removeLine: (menuItemId) => {
        setState((prev) => ({ lines: prev.lines.filter((l) => l.menuItemId !== menuItemId) }));
      },
      clear: () => setState({ lines: [] })
    };
  }, [state]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

