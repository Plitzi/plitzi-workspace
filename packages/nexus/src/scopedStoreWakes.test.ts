import { describe, it, expect, vi } from 'vitest';

import createStore from './createStore';

// Focused coverage + micro-benchmark for the scope-chain wake propagation. Kept out of `scopedStore.test.tsx`
// (already large). These assert that a parent change wakes only the child listeners whose path it can affect,
// instead of waking every listener and relying on consumer-level equality to bail (the old "wake-all" forward).

type S = { a: number; b: number; c: number };

describe('scoped store: chain wake propagation is path-scoped', () => {
  it('wakes only the child path-listener affected by the parent change', () => {
    const parent = createStore<S>({ a: 1, b: 2, c: 3 });
    const child = createStore<S>({}, { parent });
    const onA = vi.fn();
    const onB = vi.fn();
    const onC = vi.fn();
    child.subscribePath('a', onA);
    child.subscribePath('b', onB);
    child.subscribePath('c', onC);

    parent.setState('a', 10);

    expect(onA).toHaveBeenCalledTimes(1);
    expect(onB).not.toHaveBeenCalled();
    expect(onC).not.toHaveBeenCalled();
  });

  it('still wakes full-state subscribers on any parent change', () => {
    const parent = createStore<S>({ a: 1, b: 2, c: 3 });
    const child = createStore<S>({}, { parent });
    const onFull = vi.fn();
    child.subscribe(onFull);

    parent.setState('a', 10);

    expect(onFull).toHaveBeenCalledTimes(1);
  });

  it('wakes all child path-listeners on a parent full-state replace', () => {
    const parent = createStore<S>({ a: 1, b: 2, c: 3 });
    const child = createStore<S>({}, { parent });
    const onA = vi.fn();
    const onB = vi.fn();
    child.subscribePath('a', onA);
    child.subscribePath('b', onB);

    parent.setState(undefined, { a: 9, b: 9, c: 9 });

    expect(onA).toHaveBeenCalledTimes(1);
    expect(onB).toHaveBeenCalledTimes(1);
  });

  it('propagates path-scoped wakes through multiple chain levels', () => {
    const parent = createStore<S>({ a: 1, b: 2, c: 3 });
    const mid = createStore<S>({}, { parent });
    const leaf = createStore<S>({}, { parent: mid });
    const onA = vi.fn();
    const onB = vi.fn();
    leaf.subscribePath('a', onA);
    leaf.subscribePath('b', onB);

    parent.setState('a', 10);

    expect(onA).toHaveBeenCalledTimes(1);
    expect(onB).not.toHaveBeenCalled();
  });
});

describe('scoped store: wake fan-out benchmark', () => {
  it('scales with affected listeners, not the total subscribed', () => {
    const N = 100; // distinct sibling sources in a child scope
    const M = 50; // updates to a single parent key

    type Wide = Record<string, number>;
    const initial: Wide = {};
    for (let i = 0; i < N; i++) {
      initial[`k${i}`] = 0;
    }

    const parent = createStore<Wide>(initial);
    const child = createStore<Wide>({}, { parent });

    let totalWakes = 0;
    for (let i = 0; i < N; i++) {
      child.subscribePath(`k${i}`, () => {
        totalWakes++;
      });
    }

    for (let m = 0; m < M; m++) {
      parent.setState('k0', m + 1);
    }

    // Path-scoped forward wakes only the `k0` listener per update → M wakes.
    // The old wake-all forward would wake every listener each update → N * M (here 5000).
    expect(totalWakes).toBe(M);
  });
});
