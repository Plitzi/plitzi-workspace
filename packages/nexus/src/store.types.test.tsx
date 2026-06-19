/**
 * Type-level regression tests for useStore / createStoreHook overloads.
 *
 * These tests use vitest's `expectTypeOf` so failures are caught at
 * type-check time (yarn typecheck) AND at test runtime.
 *
 * Coverage map — every public overload is exercised:
 *
 *  String path
 *    [1]  no options                        → PathValue, no | undefined
 *    [3]  optional path, no options         → PathValue (already T | undefined)
 *    [5]  { transformer }                   → TResult, setter unchanged
 *
 *  Function path (same variants)
 *    [6], [8], [10]
 *
 *  No-arg (full state)
 *    [11] no options                        → [TState, setState]
 *
 *  Multi string path
 *    [12] no options                        → PathValues tuple
 *    [16] { transformer }                   → TResult, setters unchanged
 *    [17] setters typed per-path
 *
 *  Mixed PathOrFn array
 *    [18] no options                        → PathOrFnValues tuple
 *    [21] { transformer }                   → TResult, setters unchanged
 *    [22] setters typed per-path
 *
 *  createStoreHook bound overloads
 *    [23] spot-checks that bound overloads match base for key cases
 *
 *  Note: fallbacks are no longer a hook option — callers use destructuring
 *  defaults (`const [x = fallback] = useStore(path)`), so there are no
 *  `defaultValue` overloads to guard here.
 */

import { renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { describe, it, expectTypeOf } from 'vitest';

import createStore, { createStoreHook } from './createStore';
import { StoreContext } from './StoreProvider';

import type { StoreApi } from './types';
import type { ReactNode } from 'react';

// ─── shared state shape ───────────────────────────────────────────────────────

type AppState = {
  user: { name: string; nickname?: string };
  schema: { flat: Record<string, { label: string; type: string }> };
  count: number;
  score?: number;
  tag?: string;
};

const makeStore = () =>
  createStore<AppState>(() => ({
    user: { name: 'Alice' },
    schema: { flat: {} },
    count: 0
  }));

const makeWrapper =
  (store: StoreApi<AppState>) =>
  ({ children }: { children: ReactNode }) =>
    createElement(StoreContext, { value: store }, children);

const { useStore } = createStoreHook<AppState>();

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Returns 'yes' if undefined ∈ T, 'no' otherwise. Tuple-wrap avoids distributive evaluation. */
type HasUndefined<T> = [undefined] extends [T] ? 'yes' : 'no';

// =============================================================================
// [1]–[5]  STRING PATH overloads
// =============================================================================

describe('useStore types — string path', () => {
  // [1] no options
  it('[1] no options → PathValue, no | undefined for required paths', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore('count'), { wrapper: makeWrapper(store) });
    const [value, setter] = result.current;

    expectTypeOf(value).toEqualTypeOf<number>();
    expectTypeOf<HasUndefined<typeof value>>().toEqualTypeOf<'no'>();
    expectTypeOf(setter).toEqualTypeOf<(v: number | ((prev: number) => number)) => void>();
  });

  // [3] optional path, no options
  it('[3] optional path, no options → already T | undefined', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore('tag'), { wrapper: makeWrapper(store) });
    const [value, setter] = result.current;

    expectTypeOf(value).toEqualTypeOf<string | undefined>();
    expectTypeOf(setter).toEqualTypeOf<
      (v: string | undefined | ((prev: string | undefined) => string | undefined)) => void
    >();
  });

  // [3b] destructuring default widens a required path to | undefined (replaces the old defaultValue overload)
  it('[3b] destructuring default → PathValue | undefined', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore('count'), { wrapper: makeWrapper(store) });
    const [value = undefined] = result.current;

    expectTypeOf(value).toEqualTypeOf<number | undefined>();
    expectTypeOf<HasUndefined<typeof value>>().toEqualTypeOf<'yes'>();
  });

  // [5] { transformer }
  it('[5] { transformer: T → string } → string, setter still PathValue setter', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore('count', { transformer: n => String(n) }), {
      wrapper: makeWrapper(store)
    });
    const [value, setter] = result.current;

    expectTypeOf(value).toEqualTypeOf<string>();
    // setter is NOT transformed — it still accepts the raw PathValue
    expectTypeOf(setter).toEqualTypeOf<(v: number | ((prev: number) => number)) => void>();
  });

  // [5b] { transformer } returning an object
  it('[5b] { transformer: T → object } → object type', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore('count', { transformer: n => ({ doubled: n * 2 }) }), {
      wrapper: makeWrapper(store)
    });
    const [value] = result.current;

    expectTypeOf(value).toEqualTypeOf<{ doubled: number }>();
  });
});

// =============================================================================
// [6]–[10]  FUNCTION PATH overloads
// =============================================================================

describe('useStore types — function path', () => {
  // [6] no options
  it('[6] no options → PathValue, no | undefined for required paths', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore(() => 'count' as const), { wrapper: makeWrapper(store) });
    const [value, setter] = result.current;

    expectTypeOf(value).toEqualTypeOf<number>();
    expectTypeOf<HasUndefined<typeof value>>().toEqualTypeOf<'no'>();
    expectTypeOf(setter).toEqualTypeOf<(v: number | ((prev: number) => number)) => void>();
  });

  // [8] optional path fn, no options
  it('[8] optional path fn, no options → already T | undefined', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore(() => 'tag' as const), { wrapper: makeWrapper(store) });
    const [value] = result.current;

    expectTypeOf(value).toEqualTypeOf<string | undefined>();
  });

  // [10] { transformer }
  it('[10] { transformer: T → string } → string, setter still PathValue setter', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore(() => 'count' as const, { transformer: n => String(n) }), {
      wrapper: makeWrapper(store)
    });
    const [value, setter] = result.current;

    expectTypeOf(value).toEqualTypeOf<string>();
    expectTypeOf(setter).toEqualTypeOf<(v: number | ((prev: number) => number)) => void>();
  });

  // [10b] { transformer } returning an object
  it('[10b] { transformer: T → object } → object type', () => {
    const store = makeStore();
    const { result } = renderHook(
      () => useStore(() => 'user' as const, { transformer: u => ({ ...u, display: u.name.toUpperCase() }) }),
      { wrapper: makeWrapper(store) }
    );
    const [value] = result.current;

    expectTypeOf(value).toEqualTypeOf<{ name: string; nickname?: string; display: string }>();
  });
});

// =============================================================================
// [11]  NO-ARG (full state) overload
// =============================================================================

describe('useStore types — no path (full state)', () => {
  // [11]
  it('[11] no options → [TState, setState]', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore(), { wrapper: makeWrapper(store) });
    const [value] = result.current;

    expectTypeOf(value).toEqualTypeOf<AppState>();
  });
});

// =============================================================================
// [12]–[17]  MULTI STRING PATH overloads
// =============================================================================

describe('useStore types — multi string path', () => {
  // [12] no options
  it('[12] no options → PathValues tuple, no | undefined for required paths', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore(['count', 'user.name'] as const), {
      wrapper: makeWrapper(store)
    });
    const [values] = result.current;

    expectTypeOf(values[0]).toEqualTypeOf<number>();
    expectTypeOf(values[1]).toEqualTypeOf<string>();
  });

  // [12b] positional destructuring defaults widen per-position (replaces the old array defaultValue overload)
  it('[12b] positional destructuring defaults → per-position widening', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore(['tag', 'count'] as const), { wrapper: makeWrapper(store) });
    const [[tag = 'fallback', count = undefined]] = result.current;

    expectTypeOf(tag).toEqualTypeOf<string>();
    expectTypeOf(count).toEqualTypeOf<number | undefined>();
  });

  // [16] { transformer }
  it('[16] { transformer } → TResult, setters still PathValue setters', () => {
    const store = makeStore();
    const { result } = renderHook(
      () => useStore(['count', 'user.name'] as const, { transformer: ([n, s]) => `${s}:${n}` }),
      { wrapper: makeWrapper(store) }
    );
    const [value, setCount, setName] = result.current;

    expectTypeOf(value).toEqualTypeOf<string>();
    expectTypeOf(setCount).toEqualTypeOf<(v: number | ((prev: number) => number)) => void>();
    expectTypeOf(setName).toEqualTypeOf<(v: string | ((prev: string) => string)) => void>();
  });

  // [17] setters typed per-path
  it('[17] setters typed per-path — required and optional paths differ', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore(['count', 'tag', 'user.name'] as const), {
      wrapper: makeWrapper(store)
    });
    const [, setCount, setTag, setName] = result.current;

    expectTypeOf(setCount).toEqualTypeOf<(v: number | ((prev: number) => number)) => void>();
    expectTypeOf(setTag).toEqualTypeOf<
      (v: string | undefined | ((prev: string | undefined) => string | undefined)) => void
    >();
    expectTypeOf(setName).toEqualTypeOf<(v: string | ((prev: string) => string)) => void>();
  });
});

// =============================================================================
// [18]–[22]  MIXED PathOrFn array overloads
// =============================================================================

describe('useStore types — mixed PathOrFn array', () => {
  // [18] no options
  it('[18] no options → PathOrFnValues tuple members are typed', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore(['count', () => 'user.name' as const] as const), {
      wrapper: makeWrapper(store)
    });
    const [values] = result.current;

    expectTypeOf(values[0]).toEqualTypeOf<number>();
    expectTypeOf(values[1]).toEqualTypeOf<string>();
  });

  // [21] { transformer }
  it('[21] { transformer } → TResult, setters still PathValue setters', () => {
    const store = makeStore();
    const { result } = renderHook(
      () =>
        useStore(['count', () => 'user.name' as const] as const, {
          transformer: ([n, s]) => `${s}:${n}`
        }),
      { wrapper: makeWrapper(store) }
    );
    const [value, setCount, setName] = result.current;

    expectTypeOf(value).toEqualTypeOf<string>();
    expectTypeOf(setCount).toEqualTypeOf<(v: number | ((prev: number) => number)) => void>();
    expectTypeOf(setName).toEqualTypeOf<(v: string | ((prev: string) => string)) => void>();
  });

  // [22] setters typed per-path (string and function entries)
  it('[22] setters typed per-path — string and function entries', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore(['count', () => 'tag' as const] as const), {
      wrapper: makeWrapper(store)
    });
    const [, setCount, setTag] = result.current;

    expectTypeOf(setCount).toEqualTypeOf<(v: number | ((prev: number) => number)) => void>();
    expectTypeOf(setTag).toEqualTypeOf<
      (v: string | undefined | ((prev: string | undefined) => string | undefined)) => void
    >();
  });
});

// =============================================================================
// [23]  createStoreHook bound overloads — spot checks
// =============================================================================

describe('createStoreHook bound useStore — key overloads match base', () => {
  // string path
  it('[23a] string path, no options → PathValue', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore('count'), { wrapper: makeWrapper(store) });
    const [value] = result.current;

    expectTypeOf(value).toEqualTypeOf<number>();
    expectTypeOf<HasUndefined<typeof value>>().toEqualTypeOf<'no'>();
  });

  it('[23d] string path, { transformer } → TResult', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore('count', { transformer: n => ({ value: n }) }), {
      wrapper: makeWrapper(store)
    });
    const [value] = result.current;

    expectTypeOf(value).toEqualTypeOf<{ value: number }>();
  });

  // function path
  it('[23e] function path, no options → PathValue', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore(() => 'count' as const), { wrapper: makeWrapper(store) });
    const [value] = result.current;

    expectTypeOf(value).toEqualTypeOf<number>();
    expectTypeOf<HasUndefined<typeof value>>().toEqualTypeOf<'no'>();
  });

  it('[23h] function path, { transformer } → TResult', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore(() => 'count' as const, { transformer: n => ({ value: n }) }), {
      wrapper: makeWrapper(store)
    });
    const [value] = result.current;

    expectTypeOf(value).toEqualTypeOf<{ value: number }>();
  });

  // multi-path spot checks
  it('[23i] multi-path, no options → PathValues', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore(['count', 'tag'] as const), { wrapper: makeWrapper(store) });
    const [values] = result.current;

    expectTypeOf(values[0]).toEqualTypeOf<number>();
    expectTypeOf(values[1]).toEqualTypeOf<string | undefined>();
  });

  it('[23j] multi-path, { transformer } → TResult', () => {
    const store = makeStore();
    const { result } = renderHook(
      () => useStore(['count', 'tag'] as const, { transformer: ([n, t]) => `${t ?? ''}:${n}` }),
      { wrapper: makeWrapper(store) }
    );
    const [value] = result.current;

    expectTypeOf(value).toEqualTypeOf<string>();
  });
});
