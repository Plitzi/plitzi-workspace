import { describe, it, expect } from 'vitest';

import createStore from './createStore';

// The store's immutability contract: a value handed out by `getState`/`getPath` is a point-in-time snapshot that a
// later `setState` must never mutate — writes build new objects along the changed spine and share everything else.
// This is what keeps a React render (or a history entry) stable while the store keeps changing. These tests pin that
// down for both write paths (single-segment in-place mutation and multi-segment structural sharing).

type State = {
  count: number;
  user: { name: string; address: { city: string } };
  items: Record<string, { qty: number }>;
};

const make = () =>
  createStore<State>({
    count: 0,
    user: { name: 'Ada', address: { city: 'London' } },
    items: { a: { qty: 1 }, b: { qty: 2 } }
  });

describe('immutability — a write never mutates a prior snapshot', () => {
  it('single-segment write leaves an earlier getState() untouched', () => {
    const store = make();
    const before = store.getState();

    store.setState('count', 99);

    expect(before.count).toBe(0);
    expect(store.getState().count).toBe(99);
    expect(store.getState()).not.toBe(before);
  });

  it('single-segment object replace does not mutate the old object', () => {
    const store = make();
    const oldItems = store.getState().items;

    store.setState('items', { a: { qty: 5 } });

    expect(oldItems).toEqual({ a: { qty: 1 }, b: { qty: 2 } });
    expect(store.getState().items).not.toBe(oldItems);
  });

  it('multi-segment write leaves a deep branch captured earlier untouched', () => {
    const store = make();
    const before = store.getState();
    const addressBefore = before.user.address;

    store.setState('user.address.city', 'Paris');

    expect(addressBefore.city).toBe('London');
    expect(store.getPath('user.address.city')).toBe('Paris');
  });

  it('updater form resolves against the previous value without mutating it', () => {
    const store = make();
    const before = store.getState();

    store.setState('items.a.qty', prev => prev + 10);

    expect(before.items.a.qty).toBe(1);
    expect(store.getPath('items.a.qty')).toBe(11);
  });

  it('a snapshot survives a burst of writes to the same path', () => {
    const store = make();
    const before = store.getState();

    for (let i = 1; i <= 50; i++) {
      store.setState('count', i);
    }

    expect(before.count).toBe(0);
    expect(store.getState().count).toBe(50);
  });
});

describe('immutability — structural sharing', () => {
  it('clones every node on the touched spine and shares untouched siblings', () => {
    const store = make();
    const before = store.getState();

    store.setState('user.address.city', 'Berlin');
    const after = store.getState();

    // Touched spine: root → user → address all get fresh references.
    expect(after).not.toBe(before);
    expect(after.user).not.toBe(before.user);
    expect(after.user.address).not.toBe(before.user.address);

    // Untouched siblings keep their identity (no needless copying).
    expect(after.items).toBe(before.items);
    expect(after.user.name).toBe(before.user.name);
  });

  it('a write to one map entry shares the sibling entries but replaces the written one', () => {
    const store = make();
    const aBefore = store.getState().items.a;
    const bBefore = store.getState().items.b;

    store.setState('items.a.qty', 7);

    expect(store.getState().items.b).toBe(bBefore);
    expect(store.getState().items.a).not.toBe(aBefore);
  });
});

describe('immutability — referential stability', () => {
  it('returns the same snapshot reference until something changes', () => {
    const store = make();

    expect(store.getState()).toBe(store.getState());
  });

  it('returns a new snapshot reference after a change', () => {
    const store = make();
    const before = store.getState();

    store.setState('count', 1);

    expect(store.getState()).not.toBe(before);
  });

  it('a no-op write (identical value) keeps the snapshot reference stable', () => {
    const store = make();
    const before = store.getState();

    store.setState('count', 0);
    store.setState('items.a.qty', 1);

    expect(store.getState()).toBe(before);
  });
});

describe('immutability — history / time-travel safety', () => {
  it('snapshots captured across writes each retain their point-in-time value', () => {
    const store = make();
    const history: State[] = [];

    for (let i = 0; i < 5; i++) {
      store.setState('count', i);
      history.push(store.getState());
    }

    expect(history.map(s => s.count)).toEqual([0, 1, 2, 3, 4]);
    // Every captured snapshot is a distinct object — none was mutated in place by a later write.
    expect(new Set(history).size).toBe(5);
  });
});
