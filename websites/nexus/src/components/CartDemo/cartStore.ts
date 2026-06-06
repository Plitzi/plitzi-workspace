import { createStoreHook } from '@plitzi/nexus';

export type CartProduct = {
  name: string;
  price: number;
  qty: number;
};

export type CartState = {
  items: Record<string, CartProduct>;
};

export const CART_PRODUCT_IDS = ['coffee', 'bagel', 'juice'];

export const CART_INITIAL: CartState = {
  items: {
    coffee: { name: 'Coffee', price: 4, qty: 1 },
    bagel: { name: 'Bagel', price: 3, qty: 0 },
    juice: { name: 'Orange juice', price: 5, qty: 0 }
  }
};

export const { useStore: useCart, useStoreSetter: useCartSetter } = createStoreHook<CartState>();
