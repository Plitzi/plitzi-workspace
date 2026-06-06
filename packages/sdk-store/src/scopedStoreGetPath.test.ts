import { describe, it, expect } from 'vitest';

import createStore from './createStore';
import { makeSingleSnapshot } from './createStore/hooks/shared';

import type { StoreApiInternal } from './types';

// Coverage + micro-benchmark for `getPath` (single-path chain resolution). Kept out of the large
// `scopedStore.test.tsx`. The win is avoiding the full-state deep-merge for reads of a path the scope does not
// own (the common case from nested scopes: globals, sibling sources).

type S = { a: number; nested: { x: number; y: number } };

describe('scoped store: getPath resolves a single path through the chain', () => {
  it('returns the own value when the scope owns the path', () => {
    const parent = createStore<S>({ a: 1, nested: { x: 1, y: 2 } });
    const child = createStore<S>({ a: 99 }, { parent });

    expect(child.getPath('a')).toBe(99); // shadows parent
  });

  it('falls through to the parent for paths the scope does not own', () => {
    const parent = createStore<S>({ a: 1, nested: { x: 1, y: 2 } });
    const child = createStore<S>({}, { parent });

    expect(child.getPath('a')).toBe(1);
    expect(child.getPath('nested')).toEqual({ x: 1, y: 2 });
    expect(child.getPath('nested.x')).toBe(1);
  });

  it('deep-merges when both the scope and the chain contribute an object at the path', () => {
    type N = { runtime: { sources: Record<string, unknown> } };
    const parent = createStore<N>({ runtime: { sources: { variables: { a: 1 } } } });
    const child = createStore<N>({ runtime: { sources: { record: { b: 2 } } } }, { parent });

    expect(child.getPath('runtime.sources')).toEqual({ variables: { a: 1 }, record: { b: 2 } });
  });

  it('resolves through multiple chain levels', () => {
    const parent = createStore<S>({ a: 1, nested: { x: 1, y: 2 } });
    const mid = createStore<S>({}, { parent });
    const leaf = createStore<S>({}, { parent: mid });

    expect(leaf.getPath('a')).toBe(1);
  });
});

describe('scoped store: getPath avoids full-merge materialization (benchmark)', () => {
  it('reading a parent-owned leaf never triggers a full deep-merge', () => {
    const parent = createStore<S>({ a: 1, nested: { x: 1, y: 2 } });
    const child = createStore<S>({}, { parent });
    const snapshot = makeSingleSnapshot(child, 'a');

    let lastValue: unknown;
    for (let m = 1; m <= 50; m++) {
      parent.setState('a', m);
      lastValue = snapshot();
    }

    expect(lastValue).toBe(50);
    // Path-scoped resolution walks straight to the owner → 0 full-state merges in the child scope.
    // Before getPath, each read went through `getByPath(getState(), path)` → 50 merges (one per change).
    expect((child as StoreApiInternal<S>).getMergeCount?.()).toBe(0);
  });
});
