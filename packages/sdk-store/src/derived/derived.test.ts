import { describe, it, expect, vi } from 'vitest';

import { createDerived } from './createDerived';
import createStore from '../createStore/createStore';

type Item = { qty: number; price: number };
type CartState = { items: Record<string, Item> };

const make = () =>
  createStore<CartState>({
    items: { a: { qty: 1, price: 2 }, b: { qty: 0, price: 3 } }
  });

const totalOf = (items: Record<string, Item>) =>
  Object.values(items).reduce((sum, item) => sum + item.qty * item.price, 0);

describe('createDerived', () => {
  it('computes from store paths and recomputes when a dependency changes', () => {
    const store = make();
    const total = createDerived(store, ['items'], ([items]) => totalOf(items));

    expect(total.get()).toBe(2);

    store.setState('items.a.qty', 3);

    expect(total.get()).toBe(6);
  });

  it('wakes subscribers only when the computed result changes', () => {
    const store = make();
    const count = createDerived(store, ['items'], ([items]) => Object.keys(items).length);
    const spy = vi.fn();
    count.subscribe(spy);

    store.setState('items.a.qty', 9); // length unchanged → result identical

    expect(spy).not.toHaveBeenCalled();

    store.setState('items.c' as never, { qty: 1, price: 1 } as never); // adds a key → result changes

    expect(spy).toHaveBeenCalledTimes(1);
    expect(count.get()).toBe(3);
  });

  it('supports multiple dependency paths', () => {
    const store = make();
    const sum = createDerived(store, ['items.a.qty', 'items.b.qty'], ([a, b]) => a + b);

    expect(sum.get()).toBe(1);

    store.setState('items.b.qty', 4);

    expect(sum.get()).toBe(5);
  });

  it('recomputes lazily while there are no subscribers', () => {
    const store = make();
    let computes = 0;
    const count = createDerived(store, ['items'], ([items]) => {
      computes++;

      return Object.keys(items).length;
    });

    count.get();
    const callsAfterFirstGet = computes;

    store.setState('items.a.qty', 5);
    store.setState('items.b.qty', 6);

    // No subscribers → no eager recompute on each dependency change.
    expect(computes).toBe(callsAfterFirstGet);

    expect(count.get()).toBe(2);
  });

  it('uses a custom equality function to suppress object-identity churn', () => {
    const store = make();
    const ids = createDerived(store, ['items'], ([items]) => Object.keys(items), {
      equalityFn: (a, b) => a.length === b.length && a.every((key, i) => key === b[i])
    });
    const spy = vi.fn();
    ids.subscribe(spy);

    store.setState('items.a.qty', 7); // same keys, new array instance from Object.keys

    expect(spy).not.toHaveBeenCalled();
  });

  it('stops reacting after destroy', () => {
    const store = make();
    const total = createDerived(store, ['items'], ([items]) => totalOf(items));
    const spy = vi.fn();
    total.subscribe(spy);

    total.destroy();
    store.setState('items.a.qty', 10);

    expect(spy).not.toHaveBeenCalled();
  });
});
