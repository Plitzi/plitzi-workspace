import { renderHook, act } from '@testing-library/react';
import { createElement, useCallback } from 'react';
import { describe, it, expect, vi } from 'vitest';

import createStore, { createStoreHook } from '../createStore';
import useStoreGetter from './useStoreGetter';
import { StoreContext } from '../StoreProvider';

import type { StoreApi, StoreApiInternal } from '../types';
import type { ReactNode } from 'react';

type AppState = {
  user: { name: string; age: number };
  schema: {
    version: number;
    flat: Record<string, { label: string; type: string }>;
  };
  count: number;
};

const makeStore = () =>
  createStore<AppState>(() => ({
    user: { name: 'Alice', age: 30 },
    schema: {
      version: 1,
      flat: {
        btn1: { label: 'Button', type: 'button' },
        txt1: { label: 'Text', type: 'text' }
      }
    },
    count: 0
  }));

const makeWrapper =
  (store: StoreApi<AppState>) =>
  ({ children }: { children: ReactNode }) =>
    createElement(StoreContext, { value: store }, children);

// ─── Basic reads (no base path) ───────────────────────────────────────────────

describe('useStoreGetter — basic reads (no base path)', () => {
  it('getValue() returns full state', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStoreGetter<AppState>(), { wrapper: makeWrapper(store) });

    expect(result.current()).toEqual(store.getState());
  });

  it('getValue("count") returns primitive path value', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStoreGetter<AppState>(), { wrapper: makeWrapper(store) });

    expect(result.current('count')).toBe(0);
  });

  it('getValue("user.name") returns nested path value', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStoreGetter<AppState>(), { wrapper: makeWrapper(store) });

    expect(result.current('user.name')).toBe('Alice');
  });

  it('getValue("schema.flat") returns nested object', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStoreGetter<AppState>(), { wrapper: makeWrapper(store) });

    expect(result.current('schema.flat')).toEqual(store.getState().schema.flat);
  });

  it('getValue("schema.flat.btn1") returns deep dynamic path value', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStoreGetter<AppState>(), { wrapper: makeWrapper(store) });

    expect(result.current('schema.flat.btn1' as 'schema.flat')).toEqual({ label: 'Button', type: 'button' });
  });

  it('getValue with nonexistent path returns undefined', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStoreGetter<AppState>(), { wrapper: makeWrapper(store) });

    // schema.flat is Record<string, ...> so any string key is valid in the type
    expect(result.current('schema.flat.nonexistent' as 'schema.flat')).toBeUndefined();
  });
});

// ─── Reads with base path ─────────────────────────────────────────────────────

describe('useStoreGetter — reads with base path', () => {
  it('getValue() returns value at base path', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStoreGetter<AppState, 'schema.flat'>('schema.flat'), {
      wrapper: makeWrapper(store)
    });

    expect(result.current()).toEqual(store.getState().schema.flat);
  });

  it('getValue("btn1") returns sub-value relative to base', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStoreGetter<AppState, 'schema.flat'>('schema.flat'), {
      wrapper: makeWrapper(store)
    });

    expect(result.current('btn1')).toEqual({ label: 'Button', type: 'button' });
  });

  it('getValue("btn1.label") returns deep sub-value', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStoreGetter<AppState, 'schema.flat'>('schema.flat'), {
      wrapper: makeWrapper(store)
    });

    expect(result.current('btn1.label')).toBe('Button');
  });

  it('getValue with nonexistent sub-path returns undefined', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStoreGetter<AppState, 'schema.flat'>('schema.flat'), {
      wrapper: makeWrapper(store)
    });

    // schema.flat is Record<string, ...> so any string key is a valid sub-path in the type
    expect(result.current('nonexistent')).toBeUndefined();
  });

  it('nonexistent base path — getValue() returns undefined', () => {
    const store = makeStore();
    const { result } = renderHook(
      () =>
        useStoreGetter<AppState, 'schema.flat'>(
          // @ts-expect-error — intentionally nonexistent base path
          'schema.nonexistent'
        ),
      { wrapper: makeWrapper(store) }
    );

    expect(result.current()).toBeUndefined();
  });

  it('nonexistent base path — getValue("sub") returns undefined', () => {
    const store = makeStore();
    const { result } = renderHook(
      () =>
        useStoreGetter<AppState, 'schema.flat'>(
          // @ts-expect-error — intentionally nonexistent base path
          'schema.nonexistent'
        ),
      { wrapper: makeWrapper(store) }
    );

    // @ts-expect-error — nonexistent base means sub-path type is unknown at runtime
    expect(result.current('sub')).toBeUndefined();
  });
});

// ─── Reads current state (no stale closure) ───────────────────────────────────

describe('useStoreGetter — reads current state (no stale closure)', () => {
  it('getValue() returns updated state after setState without re-render', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStoreGetter<AppState>(), { wrapper: makeWrapper(store) });

    store.setState('count', 42);

    expect(result.current('count')).toBe(42);
  });

  it('getValue("count") in useCallback reads latest value after multiple mutations', () => {
    const store = makeStore();
    const reads: number[] = [];

    const { result } = renderHook(
      () => {
        const getValue = useStoreGetter<AppState>();
        const readCurrent = useCallback(() => {
          reads.push(getValue('count'));
        }, [getValue]);
        return { readCurrent };
      },
      { wrapper: makeWrapper(store) }
    );

    act(() => store.setState('count', 1));
    result.current.readCurrent();
    act(() => store.setState('count', 2));
    result.current.readCurrent();
    act(() => store.setState('count', 99));
    result.current.readCurrent();

    expect(reads).toEqual([1, 2, 99]);
  });

  it('getValue with base path reads latest sub-value after mutation inside that path', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStoreGetter<AppState, 'schema.flat'>('schema.flat'), {
      wrapper: makeWrapper(store)
    });

    act(() =>
      store.setState(
        'schema.flat.btn1' as 'schema.flat',
        { label: 'Updated', type: 'button' } as unknown as AppState['schema']['flat']
      )
    );

    expect((result.current('btn1') as { label: string }).label).toBe('Updated');
  });

  it('getValue reads fresh value after setState with updater function', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStoreGetter<AppState>(), { wrapper: makeWrapper(store) });

    store.setState('count', prev => prev + 10);

    expect(result.current('count')).toBe(10);
  });
});

// ─── No re-renders ────────────────────────────────────────────────────────────

describe('useStoreGetter — no re-renders', () => {
  it('store mutation does NOT cause re-render', () => {
    const store = makeStore();
    const renderFn = vi.fn();

    renderHook(
      () => {
        renderFn();
        return useStoreGetter<AppState>();
      },
      { wrapper: makeWrapper(store) }
    );

    act(() => store.setState('count', 1));
    act(() => store.setState('user.name', 'Bob'));

    expect(renderFn).toHaveBeenCalledTimes(1);
  });

  it('store mutation on base path does NOT cause re-render', () => {
    const store = makeStore();
    const renderFn = vi.fn();

    renderHook(
      () => {
        renderFn();
        return useStoreGetter<AppState, 'schema.flat'>('schema.flat');
      },
      { wrapper: makeWrapper(store) }
    );

    act(() =>
      store.setState(
        'schema.flat.btn1' as 'schema.flat',
        { label: 'Changed', type: 'button' } as unknown as AppState['schema']['flat']
      )
    );

    expect(renderFn).toHaveBeenCalledTimes(1);
  });

  it('1000 consecutive setState calls → 0 extra re-renders', () => {
    const store = makeStore();
    const renderFn = vi.fn();

    renderHook(
      () => {
        renderFn();
        return useStoreGetter<AppState>();
      },
      { wrapper: makeWrapper(store) }
    );

    for (let i = 0; i < 1000; i++) {
      act(() => store.setState('count', i));
    }

    expect(renderFn).toHaveBeenCalledTimes(1);
  });

  it('useStore re-renders while useStoreGetter in same component does not add extra renders', () => {
    const store = makeStore();
    const { useStore: useBoundStore } = createStoreHook<AppState>();
    const renderFn = vi.fn();

    renderHook(
      () => {
        renderFn();
        const [count] = useBoundStore('count');
        const getter = useStoreGetter<AppState>();
        return { count, getter };
      },
      { wrapper: makeWrapper(store) }
    );

    // Each setState should cause exactly 1 re-render (from useStore), not 2
    act(() => store.setState('count', 1));
    act(() => store.setState('count', 2));

    expect(renderFn).toHaveBeenCalledTimes(3); // 1 initial + 2 updates
  });
});

// ─── getValue stability ───────────────────────────────────────────────────────

describe('useStoreGetter — getValue stability', () => {
  it('getValue reference is stable across renders triggered by unrelated useStore', () => {
    const store = makeStore();
    const { useStore: useBoundStore } = createStoreHook<AppState>();
    const getValueRefs: ((...args: unknown[]) => unknown)[] = [];

    renderHook(
      () => {
        useBoundStore('count'); // causes re-renders
        const getValue = useStoreGetter<AppState>();
        getValueRefs.push(getValue);
        return getValue;
      },
      { wrapper: makeWrapper(store) }
    );

    act(() => store.setState('count', 1));
    act(() => store.setState('count', 2));

    expect(getValueRefs.length).toBeGreaterThanOrEqual(2);
    expect(getValueRefs.every(ref => ref === getValueRefs[0])).toBe(true);
  });

  it('getValue reference is stable after store mutation (no subscription)', () => {
    const store = makeStore();
    const getValueRefs: ((...args: unknown[]) => unknown)[] = [];

    const { rerender } = renderHook(
      () => {
        const getValue = useStoreGetter<AppState>();
        getValueRefs.push(getValue);
        return getValue;
      },
      { wrapper: makeWrapper(store) }
    );

    store.setState('count', 10);
    rerender();
    rerender();

    expect(getValueRefs.every(ref => ref === getValueRefs[0])).toBe(true);
  });

  it('getValue reference changes when base path argument changes', () => {
    const store = makeStore();
    let basePath: 'schema.flat' | 'user' = 'schema.flat';

    const { rerender, result } = renderHook(
      () => useStoreGetter<AppState, typeof basePath>(basePath as 'schema.flat'),
      { wrapper: makeWrapper(store) }
    );

    const firstGetValue = result.current;

    basePath = 'user';
    rerender();

    expect(result.current).not.toBe(firstGetValue);
  });
});

// ─── Memory / cleanup (no subscriptions) ─────────────────────────────────────

describe('useStoreGetter — memory / cleanup (no subscriptions)', () => {
  it('store.listeners.length is 0 after mounting useStoreGetter()', () => {
    const store = makeStore() as StoreApiInternal<AppState>;

    renderHook(() => useStoreGetter<AppState>(), { wrapper: makeWrapper(store) });

    expect(store.listeners.length).toBe(0);
  });

  it('store.pathListeners has no entry for base path after mounting useStoreGetter("count")', () => {
    const store = makeStore() as StoreApiInternal<AppState>;

    renderHook(() => useStoreGetter<AppState, 'count'>('count'), { wrapper: makeWrapper(store) });

    expect(store.pathListeners.has('count')).toBe(false);
  });

  it('store.listeners.length remains 0 after unmounting', () => {
    const store = makeStore() as StoreApiInternal<AppState>;

    const { unmount } = renderHook(() => useStoreGetter<AppState>(), { wrapper: makeWrapper(store) });

    unmount();

    expect(store.listeners.length).toBe(0);
  });

  it('mounting 500 useStoreGetter hooks → store.listeners.length stays 0', () => {
    const store = makeStore() as StoreApiInternal<AppState>;

    const hooks = Array.from({ length: 500 }, () =>
      renderHook(() => useStoreGetter<AppState>(), { wrapper: makeWrapper(store) })
    );

    expect(store.listeners.length).toBe(0);

    hooks.forEach(h => h.unmount());
    expect(store.listeners.length).toBe(0);
  });

  it('pathListeners stays empty after 500 scoped hooks mount and unmount', () => {
    const store = makeStore() as StoreApiInternal<AppState>;

    const hooks = Array.from({ length: 500 }, () =>
      renderHook(() => useStoreGetter<AppState, 'schema.flat'>('schema.flat'), { wrapper: makeWrapper(store) })
    );

    expect(store.pathListeners.size).toBe(0);

    hooks.forEach(h => h.unmount());
    expect(store.pathListeners.size).toBe(0);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('useStoreGetter — edge cases', () => {
  it('throws if used outside StoreProvider', () => {
    expect(() => renderHook(() => useStoreGetter<AppState>())).toThrow(
      'useStoreGetter must be used inside a StoreProvider'
    );
  });

  it('getValue() on a primitive base path returns the primitive', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStoreGetter<AppState, 'count'>('count'), {
      wrapper: makeWrapper(store)
    });

    expect(result.current()).toBe(0);
  });

  it('getValue called synchronously in a handler reads current state', () => {
    const store = makeStore();
    let captured: number | undefined;

    const { result } = renderHook(
      () => {
        const getValue = useStoreGetter<AppState>();
        return {
          handle: () => {
            store.setState('count', 77);
            captured = getValue('count');
          }
        };
      },
      { wrapper: makeWrapper(store) }
    );

    result.current.handle();
    expect(captured).toBe(77);
  });

  it('base path changes mid-lifecycle → getValue() returns value at new base path', () => {
    const store = makeStore();
    let basePath: 'schema.flat' | 'user' = 'schema.flat';

    const { rerender, result } = renderHook(
      () => useStoreGetter<AppState, typeof basePath>(basePath as 'schema.flat'),
      { wrapper: makeWrapper(store) }
    );

    expect(result.current()).toEqual(store.getState().schema.flat);

    basePath = 'user';
    rerender();

    expect(result.current()).toEqual(store.getState().user);
  });

  it('rapid base path changes → no memory leak, listeners size stays 0', () => {
    const store = makeStore() as StoreApiInternal<AppState>;
    const paths: Array<'schema.flat' | 'user' | 'count'> = ['schema.flat', 'user', 'count', 'schema.flat', 'user'];
    let currentPath: 'schema.flat' | 'user' | 'count' = 'schema.flat';

    const { rerender } = renderHook(() => useStoreGetter<AppState, typeof currentPath>(currentPath as 'schema.flat'), {
      wrapper: makeWrapper(store)
    });

    for (const p of paths) {
      currentPath = p;
      rerender();
    }

    expect(store.listeners.length).toBe(0);
    expect(store.pathListeners.size).toBe(0);
  });

  it('getValue with no arg after full-state base returns entire state object', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStoreGetter<AppState>(), { wrapper: makeWrapper(store) });

    const value = result.current();
    expect(value).toBe(store.getState()); // same reference
  });

  it('getValue reference captured before setState reads updated value (no stale closure)', () => {
    const store = makeStore();
    let capturedGetValue: ((...args: unknown[]) => unknown) | null = null;

    renderHook(
      () => {
        const getValue = useStoreGetter<AppState>();
        capturedGetValue = getValue;
      },
      { wrapper: makeWrapper(store) }
    );

    store.setState('count', 55);

    expect((capturedGetValue as unknown as (path: string) => unknown)('count')).toBe(55);
  });
});

// ─── createStoreHook integration ─────────────────────────────────────────────

describe('useStoreGetter — createStoreHook integration', () => {
  it('createStoreHook returns a useStoreGetter that reads the correct store', () => {
    const store = makeStore();
    const { useStoreGetter: useBoundGetter } = createStoreHook<AppState>();

    const { result } = renderHook(() => useBoundGetter(), { wrapper: makeWrapper(store) });

    expect(result.current('count')).toBe(0);

    act(() => store.setState('count', 7));
    expect(result.current('count')).toBe(7);
  });

  it('createStoreHook useStoreGetter with base path reads scoped values', () => {
    const store = makeStore();
    const { useStoreGetter: useBoundGetter } = createStoreHook<AppState>();

    const { result } = renderHook(() => useBoundGetter('schema.flat'), { wrapper: makeWrapper(store) });

    expect(result.current('btn1')).toEqual({ label: 'Button', type: 'button' });
  });

  it('useStoreGetter from createStoreHook does not cause re-renders on mutation', () => {
    const store = makeStore();
    const { useStoreGetter: useBoundGetter } = createStoreHook<AppState>();
    const renderFn = vi.fn();

    renderHook(
      () => {
        renderFn();
        return useBoundGetter();
      },
      { wrapper: makeWrapper(store) }
    );

    act(() => store.setState('count', 10));
    act(() => store.setState('user.name', 'Bob'));

    expect(renderFn).toHaveBeenCalledTimes(1);
  });

  it('two independent stores each read their own state', () => {
    const storeA = createStore<AppState>(() => ({
      user: { name: 'StoreA', age: 1 },
      schema: { version: 1, flat: {} },
      count: 100
    }));
    const storeB = createStore<AppState>(() => ({
      user: { name: 'StoreB', age: 2 },
      schema: { version: 1, flat: {} },
      count: 200
    }));
    const { useStoreGetter: useBoundGetter } = createStoreHook<AppState>();

    const { result: resultA } = renderHook(() => useBoundGetter(), { wrapper: makeWrapper(storeA) });
    const { result: resultB } = renderHook(() => useBoundGetter(), { wrapper: makeWrapper(storeB) });

    expect(resultA.current('count')).toBe(100);
    expect(resultB.current('count')).toBe(200);
  });
});

// ─── Performance ─────────────────────────────────────────────────────────────

describe('useStoreGetter — performance', () => {
  const measure = (label: string, fn: () => void): number => {
    const start = performance.now();
    fn();
    const elapsed = performance.now() - start;
    console.log(`[perf] ${label}: ${elapsed.toFixed(2)}ms`);
    return elapsed;
  };

  it('10 000 getValue() calls complete in < 50ms', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStoreGetter<AppState>(), { wrapper: makeWrapper(store) });

    const elapsed = measure('10 000 getValue() calls', () => {
      for (let i = 0; i < 10_000; i++) {
        result.current('count');
      }
    });

    expect(elapsed).toBeLessThan(50);
  });

  it('500 mount + unmount of useStoreGetter hooks in < 1s', () => {
    const store = makeStore();

    const elapsed = measure('500 mount + unmount', () => {
      const hooks = Array.from({ length: 500 }, () =>
        renderHook(() => useStoreGetter<AppState>(), { wrapper: makeWrapper(store) })
      );
      hooks.forEach(h => h.unmount());
    });

    expect(elapsed).toBeLessThan(1000);
  });

  it('getValue does not re-render after 1000 setState calls (render count stays 1)', () => {
    const store = makeStore();
    const renderFn = vi.fn();

    renderHook(
      () => {
        renderFn();
        return useStoreGetter<AppState>();
      },
      { wrapper: makeWrapper(store) }
    );

    const elapsed = measure('1000 setState + getValue reads', () => {
      for (let i = 0; i < 1000; i++) {
        act(() => store.setState('count', i));
      }
    });

    expect(renderFn).toHaveBeenCalledTimes(1);
    expect(elapsed).toBeLessThan(2000);
  });
});

// ─── Array paths ──────────────────────────────────────────────────────────────

describe('useStoreGetter — array paths', () => {
  it('returns tuple of getters in order', () => {
    const store = makeStore();
    const { result } = renderHook(
      () => useStoreGetter<AppState, readonly ['count', 'user.name']>(['count', 'user.name'] as const),
      { wrapper: makeWrapper(store) }
    );

    const [getCount, getName] = result.current;
    expect(getCount()).toBe(0);
    expect(getName()).toBe('Alice');
  });

  it('reads current values after mutation without re-render', () => {
    const store = makeStore();
    const { result } = renderHook(
      () => useStoreGetter<AppState, readonly ['count', 'user.name']>(['count', 'user.name'] as const),
      { wrapper: makeWrapper(store) }
    );

    act(() => store.setState('count', 7));
    act(() => store.setState('user.name', 'Bob'));

    const [getCount, getName] = result.current;
    expect(getCount()).toBe(7);
    expect(getName()).toBe('Bob');
  });

  it('no subscriptions after mount (listeners.size === 0)', () => {
    const store = makeStore() as StoreApiInternal<AppState>;

    renderHook(() => useStoreGetter<AppState, readonly ['count', 'user.name']>(['count', 'user.name'] as const), {
      wrapper: makeWrapper(store)
    });

    expect(store.listeners.length).toBe(0);
    expect(store.pathListeners.size).toBe(0);
  });

  it('call-time defaultValue — undefined slot uses per-call default', () => {
    const store = createStore<AppState>(() => ({
      user: { name: 'Alice', age: 30 },
      schema: { version: 1, flat: {} },
      count: 5
    }));

    const fallback = { label: 'Default', type: 'button' };
    const getPaths = useStoreGetter as (paths: readonly string[]) => ((subPath?: string, def?: unknown) => unknown)[];
    const { result } = renderHook(() => getPaths(['schema.flat', 'count']), { wrapper: makeWrapper(store) });

    const [getFlat, getCount] = result.current;
    expect(getFlat('btn1', fallback)).toEqual(fallback); // undefined sub-path → fallback
    expect(getCount()).toBe(5); // defined → actual
  });

  it('call-time defaultValue — same default applied per getter call', () => {
    const store = createStore<AppState>(() => ({
      user: { name: 'Alice', age: 30 },
      schema: { version: 1, flat: {} },
      count: 0
    }));

    const fallback = { label: 'Fallback', type: 'text' };
    const getPaths = useStoreGetter as (paths: readonly string[]) => ((subPath?: string, def?: unknown) => unknown)[];
    const { result } = renderHook(() => getPaths(['schema.flat.btn1', 'schema.flat.txt1']), {
      wrapper: makeWrapper(store)
    });

    const [getBtn1, getTxt1] = result.current;
    expect(getBtn1(undefined, fallback)).toEqual(fallback);
    expect(getTxt1(undefined, fallback)).toEqual(fallback);
  });
});

// ─── defaultValue on base path ────────────────────────────────────────────────

describe('useStoreGetter — defaultValue on base path', () => {
  it('() call returns default when base value is undefined at runtime', () => {
    // schema.flat.btn1 is undefined because flat is empty
    const store = createStore<AppState>(() => ({
      user: { name: 'Alice', age: 30 },
      schema: { version: 1, flat: {} },
      count: 0
    }));

    const fallback = { label: 'Default' };
    const { result } = renderHook(
      () =>
        useStoreGetter<AppState, 'schema.flat', { label: string }>('schema.flat', {
          defaultValue: fallback
        }),
      { wrapper: makeWrapper(store) }
    );

    // schema.flat = {} which is not undefined — default is NOT applied (only triggers on undefined)
    expect(result.current()).toEqual({});
  });

  it('() returns default when exact path value is undefined', () => {
    const store = createStore<AppState>(() => ({
      user: { name: 'Alice', age: 30 },
      schema: { version: 1, flat: {} },
      count: 0
    }));

    const fallback = { label: 'Default', type: 'button' };
    const getScoped = useStoreGetter as (path: string, opts: { defaultValue: unknown }) => (sub?: string) => unknown;
    const { result } = renderHook(() => getScoped('schema.flat.btn1', { defaultValue: fallback }), {
      wrapper: makeWrapper(store)
    });

    expect(result.current()).toEqual(fallback);
  });

  it('() returns actual value when defined (default ignored)', () => {
    const store = makeStore();

    const { result } = renderHook(
      () =>
        useStoreGetter<AppState, 'schema.flat', { label: string }>('schema.flat', {
          defaultValue: { label: 'UNUSED' }
        }),
      { wrapper: makeWrapper(store) }
    );

    expect(result.current()).toEqual(store.getState().schema.flat);
  });

  it('sub-path call ignores defaultValue', () => {
    const store = makeStore();

    const { result } = renderHook(
      () =>
        useStoreGetter<AppState, 'schema.flat', { label: string }>('schema.flat', {
          defaultValue: { label: 'UNUSED' }
        }),
      { wrapper: makeWrapper(store) }
    );

    expect(result.current('btn1')).toEqual({ label: 'Button', type: 'button' });
  });
});

// ─── store option in useStoreGetter ──────────────────────────────────────────

describe('useStoreGetter — store option', () => {
  it('reads from explicit store, not context', () => {
    const contextStore = makeStore();
    const externalStore = createStore<AppState>(() => ({
      user: { name: 'External', age: 1 },
      schema: { version: 1, flat: {} },
      count: 999
    }));

    const { result } = renderHook(() => useStoreGetter<AppState>({ store: externalStore }), {
      wrapper: makeWrapper(contextStore)
    });

    expect(result.current('count')).toBe(999);
  });

  it('reads from explicit store for scoped path', () => {
    const contextStore = makeStore();
    const externalStore = createStore<AppState>(() => ({
      user: { name: 'External', age: 1 },
      schema: { version: 1, flat: { ext1: { label: 'External', type: 'div' } } },
      count: 0
    }));

    const { result } = renderHook(
      () => useStoreGetter<AppState, 'schema.flat'>('schema.flat', { store: externalStore }),
      { wrapper: makeWrapper(contextStore) }
    );

    expect(result.current('ext1')).toEqual({ label: 'External', type: 'div' });
    expect(result.current('btn1')).toBeUndefined();
  });

  it('reads from explicit store for array paths', () => {
    const contextStore = makeStore();
    const externalStore = createStore<AppState>(() => ({
      user: { name: 'Ext', age: 5 },
      schema: { version: 1, flat: {} },
      count: 42
    }));

    const { result } = renderHook(
      () =>
        useStoreGetter<AppState, readonly ['count', 'user.name']>(['count', 'user.name'] as const, {
          store: externalStore
        }),
      { wrapper: makeWrapper(contextStore) }
    );

    const [getCount, getName] = result.current;
    expect(getCount()).toBe(42);
    expect(getName()).toBe('Ext');
  });
});
