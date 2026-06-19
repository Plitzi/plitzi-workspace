import { describe, it, expect, vi } from 'vitest';

import createStore from '.';

type S = { runtime?: { state?: Record<string, unknown> }; count: number };

const makeStore = () => createStore<S>({ runtime: { state: { a: 1 } }, count: 0 });

describe('store.withBase', () => {
  it('reads the base value and sub-paths', () => {
    const base = makeStore().withBase('runtime.state');

    expect(base.getState()).toEqual({ a: 1 });
    expect(base.getPath('a')).toBe(1);
    expect(base.getPath('missing')).toBeUndefined();
  });

  it('returns the defaultValue when the base or a sub-path is undefined', () => {
    const store = createStore<S>({ count: 0 });
    const base = store.withBase('runtime.state');

    expect(base.getState({ fallback: true })).toEqual({ fallback: true });
    expect(base.getPath('a', 42)).toBe(42);
  });

  it('ignores the defaultValue when the value exists', () => {
    const base = makeStore().withBase('runtime.state');

    expect(base.getState({ fallback: true })).toEqual({ a: 1 });
    expect(base.getPath('a', 42)).toBe(1);
  });

  it('replaces the base with a value or an updater', () => {
    const store = makeStore();
    const base = store.withBase('runtime.state');

    base.setState(undefined, { a: 2, b: 3 });
    expect(store.getState().runtime?.state).toEqual({ a: 2, b: 3 });

    base.setState(undefined, prev => ({ ...prev, c: 4 }));
    expect(store.getState().runtime?.state).toEqual({ a: 2, b: 3, c: 4 });
  });

  it('writes a sub-path under the base', () => {
    const store = makeStore();
    const base = store.withBase('runtime.state');

    base.setState('a', 9);
    expect(store.getState().runtime?.state?.a).toBe(9);
  });

  it('notifies base subscribers on sub-path and base writes', () => {
    const store = makeStore();
    const base = store.withBase('runtime.state');
    const listener = vi.fn();
    const unsubscribe = base.subscribe(listener);

    base.setState('a', 2);
    base.setState(undefined, { a: 3 });
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    base.setState('a', 4);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('notifies sub-path subscribers only for their sub-path', () => {
    const store = makeStore();
    const base = store.withBase('runtime.state');
    const listener = vi.fn();
    base.subscribePath('a', listener);

    base.setState('b', 1);
    expect(listener).not.toHaveBeenCalled();

    base.setState('a', 5);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
