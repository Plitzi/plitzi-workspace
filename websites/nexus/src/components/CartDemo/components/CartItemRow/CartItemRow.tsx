import { useCallback } from 'react';

import { useCartSetter } from '../../cartStore';

import type { CartState } from '../../cartStore';
import type { PathOf } from '@plitzi/nexus';

export type CartItemRowProps = {
  id: string;
  name: string;
  price: number;
  qty: number;
};

const CartItemRow = ({ id, name, price, qty }: CartItemRowProps) => {
  const setState = useCartSetter();
  const path = `items.${id}.qty` as PathOf<CartState>;

  // Dynamic path widens the value type to a union; the number is sound, so cast to satisfy it.
  const handleDecrement = useCallback(() => setState(path, Math.max(0, qty - 1) as never), [setState, path, qty]);

  const handleIncrement = useCallback(() => setState(path, (qty + 1) as never), [setState, path, qty]);

  return (
    <div className="border-ink-800 flex items-center gap-3 border-b py-2 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-white">{name}</div>
        <div className="font-mono text-xs text-zinc-500">${price}</div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleDecrement}
          className="border-ink-600 bg-ink-800 hover:border-brand-500 flex h-7 w-7 items-center justify-center rounded-md border text-zinc-300 transition hover:text-white"
        >
          −
        </button>
        <span className="w-6 text-center font-mono text-sm text-white">{qty}</span>
        <button
          onClick={handleIncrement}
          className="border-ink-600 bg-ink-800 hover:border-brand-500 flex h-7 w-7 items-center justify-center rounded-md border text-zinc-300 transition hover:text-white"
        >
          +
        </button>
      </div>
      <div className="text-brand-300 w-16 text-right font-mono text-sm">${price * qty}</div>
    </div>
  );
};

export default CartItemRow;
