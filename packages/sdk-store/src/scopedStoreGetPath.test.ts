import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import createStore from './createStore';
import { makeSingleSnapshot } from './createStore/hooks/shared';
import { getStoreHistory, historyMiddleware } from './middleware/historyMiddleware';

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

describe('scoped store: getPath memoizes fall-through reads and invalidates on change', () => {
  it('returns a fresh value after an ancestor write (cache invalidated by version)', () => {
    const parent = createStore<S>({ a: 1, nested: { x: 1, y: 2 } });
    const child = createStore<S>({}, { parent });

    expect(child.getPath('a')).toBe(1);
    expect(child.getPath('a')).toBe(1); // served from cache, same value

    parent.setState('a', 7);

    expect(child.getPath('a')).toBe(7);
  });

  it('returns a fresh value after the scope starts shadowing the path (own write)', () => {
    const parent = createStore<S>({ a: 1, nested: { x: 1, y: 2 } });
    const child = createStore<S>({ a: 1 }, { parent });

    expect(child.getPath('a')).toBe(1);

    child.setState('a', 42);

    expect(child.getPath('a')).toBe(42);
  });

  it('propagates an ancestor write through multiple cached levels', () => {
    const parent = createStore<S>({ a: 1, nested: { x: 1, y: 2 } });
    const mid = createStore<S>({}, { parent });
    const leaf = createStore<S>({}, { parent: mid });

    expect(leaf.getPath('a')).toBe(1);
    expect(mid.getPath('a')).toBe(1);

    parent.setState('a', 99);

    expect(leaf.getPath('a')).toBe(99);
    expect(mid.getPath('a')).toBe(99);
  });

  it('bumps version so a non-propagating ancestor write is still observed on the next read', () => {
    const parent = createStore<S>({ a: 1, nested: { x: 1, y: 2 } });
    const child = createStore<S>({}, { parent });

    expect(child.getPath('a')).toBe(1);

    parent.setState('a', 5, false); // canPropagate=false: silent, but the parent's own version still bumps

    expect(child.getPath('a')).toBe(5);
  });

  it('invalidates a deep leaf after a silent write two levels up (invalidate channel cascades)', () => {
    const root = createStore<S>({ a: 1, nested: { x: 1, y: 2 } });
    const mid = createStore<S>({}, { parent: root });
    const leaf = createStore<S>({}, { parent: mid });

    expect(leaf.getPath('a')).toBe(1);

    root.setState('a', 9, false); // silent: mid's forwarder never fires, the invalidate channel must carry it down

    expect(leaf.getPath('a')).toBe(9);
  });

  it('reflects parent undo and redo through a live child read', () => {
    const parent = createStore<S>({ a: 1, nested: { x: 1, y: 2 } }, { middlewares: [historyMiddleware()] });
    const child = createStore<S>({}, { parent });

    expect(child.getPath('a')).toBe(1);
    parent.setState('a', 2);
    parent.setState('a', 3);
    expect(child.getPath('a')).toBe(3);

    const history = getStoreHistory(parent);
    history?.undo();
    expect(child.getPath('a')).toBe(2); // back

    history?.undo();
    expect(child.getPath('a')).toBe(1);

    history?.redo();
    expect(child.getPath('a')).toBe(2); // forward
  });

  it('keeps multiple sibling scopes sharing one parent independently fresh', () => {
    const parent = createStore<S>({ a: 1, nested: { x: 1, y: 2 } });
    const first = createStore<S>({}, { parent });
    const second = createStore<S>({}, { parent });

    expect(first.getPath('a')).toBe(1);
    expect(second.getPath('a')).toBe(1);

    parent.setState('a', 50);

    expect(first.getPath('a')).toBe(50);
    expect(second.getPath('a')).toBe(50);

    parent.setState('a', 7, false); // silent reaches every registered sibling

    expect(first.getPath('a')).toBe(7);
    expect(second.getPath('a')).toBe(7);
  });
});

describe('scoped store: dev-only sibling collision detection', () => {
  const spyOnWarn = () => vi.spyOn(console, 'warn').mockImplementation(() => {});
  let warn: ReturnType<typeof spyOnWarn>;

  beforeEach(() => {
    warn = spyOnWarn();
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('warns when two sibling scopes delegate a write to the same parent path', () => {
    const parent = createStore<S>({ a: 1, nested: { x: 1, y: 2 } });
    const first = createStore<S>({}, { parent });
    const second = createStore<S>({}, { parent });

    first.setState('a', 10); // delegates to parent (not owned locally)
    expect(warn).not.toHaveBeenCalled();

    second.setState('a', 20); // same delegated path from a different sibling

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"a"'));
  });

  it('does not warn when one scope delegates the same path repeatedly', () => {
    const parent = createStore<S>({ a: 1, nested: { x: 1, y: 2 } });
    const child = createStore<S>({}, { parent });

    child.setState('a', 1);
    child.setState('a', 2);
    child.setState('a', 3);

    expect(warn).not.toHaveBeenCalled();
  });

  it('does not warn when siblings declare the same key but never delegate (the List pattern)', () => {
    const parent = createStore<S>({ nested: { x: 1, y: 2 } });
    const first = createStore<S>({ a: 1 }, { parent });
    const second = createStore<S>({ a: 2 }, { parent });

    first.setState('a', 11); // owned locally — stays in its own scope
    second.setState('a', 22);

    expect(warn).not.toHaveBeenCalled();
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
