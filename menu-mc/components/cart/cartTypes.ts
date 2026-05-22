export type CartLine = {
  menuItemId: string;
  name: string;
  price: string | null;
  quantity: number;
};

export type CartState = {
  lines: CartLine[];
};

