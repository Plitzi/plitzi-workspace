import { describe, it, expect, vi } from 'vitest';

import createStore from './createStore';

// Path-subscription wake semantics. A listener at path L must wake whenever the value at L could have changed:
// when L itself is written, when an ANCESTOR of L is written (the subtree containing L was replaced), and when a
// DESCENDANT of L is written (a value inside L changed). It must NOT wake for an unrelated/sibling write.
//
// The shopping-cart `-`/`+` regression lived in the ancestor case for MULTI-SEGMENT writes: a component watching
// `items` never woke when `items.<id>.qty` was written, because notification keyed off the written path instead of
// walking its prefixes. These tests pin every direction down.

type CartState = { items: Record<string, { name: string; qty: number }> };

const makeCart = () =>
  createStore<CartState>({
    items: {
      coffee: { name: 'Coffee', qty: 1 },
      bagel: { name: 'Bagel', qty: 0 }
    }
  });

describe('path notification — ancestors', () => {
  it('wakes a listener on a parent path when a deep descendant is written (cart -/+ regression)', () => {
    const store = makeCart();
    const spy = vi.fn();
    store.subscribePath('items', spy);

    store.setState('items.coffee.qty', 2);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(store.getPath('items.coffee.qty')).toBe(2);
  });

  it('wakes every ancestor along the written spine', () => {
    const store = makeCart();
    const atItems = vi.fn();
    const atCoffee = vi.fn();
    const atQty = vi.fn();
    store.subscribePath('items', atItems);
    store.subscribePath('items.coffee', atCoffee);
    store.subscribePath('items.coffee.qty', atQty);

    store.setState('items.coffee.qty', 5);

    expect(atItems).toHaveBeenCalledTimes(1);
    expect(atCoffee).toHaveBeenCalledTimes(1);
    expect(atQty).toHaveBeenCalledTimes(1);
  });

  it('wakes a single-segment ancestor when its whole subtree is replaced', () => {
    const store = makeCart();
    const spy = vi.fn();
    store.subscribePath('items', spy);

    store.setState('items', { coffee: { name: 'Coffee', qty: 9 }, bagel: { name: 'Bagel', qty: 0 } });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not wake a sibling-branch listener', () => {
    const store = makeCart();
    const spy = vi.fn();
    store.subscribePath('items.bagel', spy);

    store.setState('items.coffee.qty', 7);

    expect(spy).not.toHaveBeenCalled();
  });
});

describe('path notification — descendants', () => {
  it('wakes a deep listener when an ancestor write changes its value', () => {
    const store = makeCart();
    const spy = vi.fn();
    store.subscribePath('items.coffee.qty', spy);

    store.setState('items', { coffee: { name: 'Coffee', qty: 3 }, bagel: { name: 'Bagel', qty: 0 } });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not wake a deep listener when the ancestor write leaves its value untouched', () => {
    const store = makeCart();
    const spy = vi.fn();
    store.subscribePath('items.coffee.qty', spy);

    // Replace `items` but keep coffee.qty identical → coffee.qty did not change.
    store.setState('items', { coffee: { name: 'Coffee ☕', qty: 1 }, bagel: { name: 'Bagel', qty: 0 } });

    expect(spy).not.toHaveBeenCalled();
  });

  it('wakes a deep listener whose value becomes undefined after a primitive ancestor write', () => {
    const store = makeCart();
    const spy = vi.fn();
    store.subscribePath('items.coffee.qty', spy);

    store.setState('items.coffee', null as never);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(store.getPath('items.coffee.qty')).toBeUndefined();
  });
});

describe('path notification — no-ops', () => {
  it('does not wake when the written value is identical (single segment)', () => {
    const store = createStore<{ a: number }>({ a: 1 });
    const spy = vi.fn();
    store.subscribePath('a', spy);

    store.setState('a', 1);

    expect(spy).not.toHaveBeenCalled();
  });

  it('does not wake when the written value is identical (multi segment)', () => {
    const store = makeCart();
    const spy = vi.fn();
    store.subscribePath('items', spy);

    store.setState('items.coffee.qty', 1);

    expect(spy).not.toHaveBeenCalled();
  });
});

describe('path notification — unsubscribe', () => {
  it('stops waking after unsubscribe and cleans the index', () => {
    const store = makeCart();
    const spy = vi.fn();
    const unsub = store.subscribePath('items', spy);

    store.setState('items.coffee.qty', 2);
    unsub();
    store.setState('items.coffee.qty', 3);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('wakes the remaining listeners on a path after one of several unsubscribes', () => {
    const store = makeCart();
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = store.subscribePath('items', a);
    store.subscribePath('items', b);

    unsubA();
    store.setState('items.coffee.qty', 4);

    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });
});

describe('path notification — combined directions', () => {
  it('wakes an ancestor and a descendant listener from one deep write', () => {
    const store = makeCart();
    const atItems = vi.fn();
    const atQty = vi.fn();
    store.subscribePath('items', atItems);
    store.subscribePath('items.coffee.qty', atQty);

    store.setState('items.coffee', { name: 'Coffee', qty: 42 });

    expect(atItems).toHaveBeenCalledTimes(1);
    expect(atQty).toHaveBeenCalledTimes(1);
  });

  it('resolves an updater function against the previous value', () => {
    const store = makeCart();
    const spy = vi.fn();
    store.subscribePath('items', spy);

    store.setState('items.coffee.qty', (prev: number) => prev + 1);

    expect(store.getPath('items.coffee.qty')).toBe(2);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not propagate to path listeners when canPropagate is false', () => {
    const store = makeCart();
    const spy = vi.fn();
    store.subscribePath('items', spy);

    store.setState('items.coffee.qty', 8, { canPropagate: false });

    expect(spy).not.toHaveBeenCalled();
    expect(store.getPath('items.coffee.qty')).toBe(8);
  });
});

describe('path notification — array index paths', () => {
  type ListState = { rows: Array<{ value: number }> };

  it('wakes a listener watching the list when an element field is written', () => {
    const store = createStore<ListState>({ rows: [{ value: 1 }, { value: 2 }] });
    const spy = vi.fn();
    store.subscribePath('rows', spy);

    store.setState('rows.1.value' as never, 9 as never);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(store.getPath('rows.1.value' as never)).toBe(9);
  });
});

describe('path notification — scoped stores (parent → child forwarding)', () => {
  it('wakes a child listener on a parent path when the parent writes a deep descendant', () => {
    const parent = makeCart();
    const child = createStore<CartState>({}, { parent });
    const spy = vi.fn();
    child.subscribePath('items', spy);

    parent.setState('items.coffee.qty', 3);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('wakes a child listener watching the exact path the parent writes', () => {
    const parent = makeCart();
    const child = createStore<CartState>({}, { parent });
    const spy = vi.fn();
    child.subscribePath('items.coffee.qty', spy);

    parent.setState('items.coffee.qty', 5);

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
