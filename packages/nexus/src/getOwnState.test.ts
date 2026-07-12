import { describe, it, expect } from 'vitest';

import createStore from './createStore/createStore';

describe('getOwnState', () => {
  it('returns the full state for a root store (equals getState)', () => {
    const store = createStore(() => ({ a: 1, b: 2 }));

    expect(store.getOwnState()).toEqual({ a: 1, b: 2 });
    expect(store.getOwnState()).toBe(store.getState());
  });

  it('returns only the own layer for a scoped store, not the merged parent view', () => {
    type State = { a: number; shared: { x: number }; own: number };
    const parent = createStore<State>(() => ({ a: 1, shared: { x: 1 } }));
    const child = createStore<State>(() => ({ own: 5 }), { parent });

    // getState merges parent + own; getOwnState isolates what the scope itself seeded.
    expect(child.getState()).toEqual({ a: 1, shared: { x: 1 }, own: 5 });
    expect(child.getOwnState()).toEqual({ own: 5 });
  });

  it('is reference-stable between calls with no change', () => {
    type State = { a: number; own: number };
    const child = createStore<State>(() => ({ own: 5 }), { parent: createStore<State>(() => ({ a: 1 })) });

    expect(child.getOwnState()).toBe(child.getOwnState());
  });
});
