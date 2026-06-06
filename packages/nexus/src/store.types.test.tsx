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
 *    [2]  { defaultValue: undefined }       → PathValue | undefined       ← regression guard
 *    [3]  optional path, no options         → PathValue (already T | undefined)
 *    [4]  { defaultValue: D }               → NonNullable<T> | D
 *    [5]  { transformer }                   → TResult, setter unchanged
 *
 *  Function path (same 5 variants)
 *    [6]–[10]
 *
 *  No-arg (full state)
 *    [11] no options                        → [TState, setState]
 *
 *  Multi string path
 *    [12] no options                        → PathValues tuple
 *    [13] { defaultValue: undefined }       → all T | undefined
 *    [14] positional array defaultValue     → per-position widening
 *    [15] scalar defaultValue               → same D applied to all positions
 *    [16] { transformer }                   → TResult, setters unchanged
 *    [17] setters typed per-path
 *
 *  Mixed PathOrFn array
 *    [18] no options                        → PathOrFnValues tuple
 *    [19] { defaultValue: undefined }       → all T | undefined
 *    [20] positional array defaultValue     → per-position widening
 *    [21] { transformer }                   → TResult, setters unchanged
 *    [22] setters typed per-path
 *
 *  createStoreHook bound overloads
 *    [23] spot-checks that bound overloads match base for key cases
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

  // [2] { defaultValue: undefined }  ← key regression guard
  it('[2] { defaultValue: undefined } → PathValue | undefined (regression: was missing | undefined)', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore('count', { defaultValue: undefined }), {
      wrapper: makeWrapper(store)
    });
    const [value, setter] = result.current;

    expectTypeOf(value).toEqualTypeOf<number | undefined>();
    expectTypeOf<HasUndefined<typeof value>>().toEqualTypeOf<'yes'>();
    // setter type is unchanged — still PathValue setter
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

  // [4] { defaultValue: D } — removes | undefined from optional paths
  it('[4] { defaultValue: D } → NonNullable<T> | D (undefined stripped)', () => {
    const store = makeStore();
    // tag is string | undefined; defaultValue removes the undefined
    const { result } = renderHook(() => useStore('tag', { defaultValue: 'fallback' }), {
      wrapper: makeWrapper(store)
    });
    const [value] = result.current;

    expectTypeOf(value).toEqualTypeOf<string>();
    expectTypeOf<HasUndefined<typeof value>>().toEqualTypeOf<'no'>();
  });

  // [4b] { defaultValue: D } on required path — D same type, no widening visible
  it('[4b] required path, { defaultValue: 0 } → number', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore('count', { defaultValue: 0 }), {
      wrapper: makeWrapper(store)
    });
    const [value] = result.current;

    expectTypeOf(value).toEqualTypeOf<number>();
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

  // [7] { defaultValue: undefined }  ← key regression guard
  it('[7] { defaultValue: undefined } → PathValue | undefined (regression: was missing | undefined)', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore(() => 'count' as const, { defaultValue: undefined }), {
      wrapper: makeWrapper(store)
    });
    const [value, setter] = result.current;

    expectTypeOf(value).toEqualTypeOf<number | undefined>();
    expectTypeOf<HasUndefined<typeof value>>().toEqualTypeOf<'yes'>();
    expectTypeOf(setter).toEqualTypeOf<(v: number | ((prev: number) => number)) => void>();
  });

  // [8] optional path fn, no options
  it('[8] optional path fn, no options → already T | undefined', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore(() => 'tag' as const), { wrapper: makeWrapper(store) });
    const [value] = result.current;

    expectTypeOf(value).toEqualTypeOf<string | undefined>();
  });

  // [9] { defaultValue: D }
  it('[9] { defaultValue: D } → NonNullable<T> | D (undefined stripped)', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore(() => 'tag' as const, { defaultValue: 'fallback' }), {
      wrapper: makeWrapper(store)
    });
    const [value] = result.current;

    expectTypeOf(value).toEqualTypeOf<string>();
    expectTypeOf<HasUndefined<typeof value>>().toEqualTypeOf<'no'>();
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

  // [13] { defaultValue: undefined }
  it('[13] { defaultValue: undefined } → all members T | undefined', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore(['count', 'user.name'] as const, { defaultValue: undefined }), {
      wrapper: makeWrapper(store)
    });
    const [values] = result.current;

    expectTypeOf(values[0]).toEqualTypeOf<number | undefined>();
    expectTypeOf(values[1]).toEqualTypeOf<string | undefined>();
  });

  // [14] positional array defaultValue
  it('[14] positional array default: per-position — concrete default removes | undefined, undefined default adds it', () => {
    const store = makeStore();
    const { result } = renderHook(
      () => useStore(['tag', 'count'] as const, { defaultValue: ['fallback', undefined] as const }),
      { wrapper: makeWrapper(store) }
    );
    const [values] = result.current;

    // tag: string | undefined + 'fallback' → NonNullable<string|undefined> | 'fallback' = string
    expectTypeOf(values[0]).toEqualTypeOf<string>();
    // count: number + undefined → number | undefined
    expectTypeOf(values[1]).toEqualTypeOf<number | undefined>();
  });

  // [14b] positional: both concrete defaults
  it('[14b] positional: all concrete defaults → all | undefined removed', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore(['tag', 'score'] as const, { defaultValue: ['x', 0] as const }), {
      wrapper: makeWrapper(store)
    });
    const [values] = result.current;

    expectTypeOf(values[0]).toEqualTypeOf<string>();
    expectTypeOf(values[1]).toEqualTypeOf<number>();
  });

  // [15] scalar defaultValue
  it('[15] scalar defaultValue → same D applied to all — undefined stripped from all positions', () => {
    const store = makeStore();
    // tag and user.nickname are optional; scalar 'N/A' removes | undefined from both
    const { result } = renderHook(() => useStore(['tag', 'user.nickname'] as const, { defaultValue: 'N/A' }), {
      wrapper: makeWrapper(store)
    });
    const [values] = result.current;

    expectTypeOf(values[0]).toEqualTypeOf<string>();
    expectTypeOf(values[1]).toEqualTypeOf<string>();
    expectTypeOf<HasUndefined<(typeof values)[0]>>().toEqualTypeOf<'no'>();
    expectTypeOf<HasUndefined<(typeof values)[1]>>().toEqualTypeOf<'no'>();
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

  // [19] { defaultValue: undefined }
  it('[19] { defaultValue: undefined } → all members T | undefined', () => {
    const store = makeStore();
    const { result } = renderHook(
      () => useStore(['count', () => 'user.name' as const] as const, { defaultValue: undefined }),
      { wrapper: makeWrapper(store) }
    );
    const [values] = result.current;

    expectTypeOf(values[0]).toEqualTypeOf<number | undefined>();
    expectTypeOf(values[1]).toEqualTypeOf<string | undefined>();
  });

  // [20] positional array defaultValue
  it('[20] positional array default: per-position widening', () => {
    const store = makeStore();
    const { result } = renderHook(
      () =>
        useStore(['tag', () => 'count' as const] as const, {
          defaultValue: ['fallback', undefined] as const
        }),
      { wrapper: makeWrapper(store) }
    );
    const [values] = result.current;

    // tag: string|undefined + 'fallback' → string (NonNullable | 'fallback')
    expectTypeOf(values[0]).toEqualTypeOf<string>();
    // count: number + undefined → number | undefined
    expectTypeOf(values[1]).toEqualTypeOf<number | undefined>();
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
  // string path — the 4 variants
  it('[23a] string path, no options → PathValue', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore('count'), { wrapper: makeWrapper(store) });
    const [value] = result.current;

    expectTypeOf(value).toEqualTypeOf<number>();
    expectTypeOf<HasUndefined<typeof value>>().toEqualTypeOf<'no'>();
  });

  it('[23b] string path, { defaultValue: undefined } → PathValue | undefined', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore('count', { defaultValue: undefined }), {
      wrapper: makeWrapper(store)
    });
    const [value] = result.current;

    expectTypeOf(value).toEqualTypeOf<number | undefined>();
    expectTypeOf<HasUndefined<typeof value>>().toEqualTypeOf<'yes'>();
  });

  it('[23c] string path, { defaultValue: D } → NonNullable<T> | D', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore('tag', { defaultValue: 'fallback' }), {
      wrapper: makeWrapper(store)
    });
    const [value] = result.current;

    expectTypeOf(value).toEqualTypeOf<string>();
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

  // function path — the 4 variants
  it('[23e] function path, no options → PathValue', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore(() => 'count' as const), { wrapper: makeWrapper(store) });
    const [value] = result.current;

    expectTypeOf(value).toEqualTypeOf<number>();
    expectTypeOf<HasUndefined<typeof value>>().toEqualTypeOf<'no'>();
  });

  it('[23f] function path, { defaultValue: undefined } → PathValue | undefined', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore(() => 'count' as const, { defaultValue: undefined }), {
      wrapper: makeWrapper(store)
    });
    const [value] = result.current;

    expectTypeOf(value).toEqualTypeOf<number | undefined>();
    expectTypeOf<HasUndefined<typeof value>>().toEqualTypeOf<'yes'>();
  });

  it('[23g] function path, { defaultValue: D } → NonNullable<T> | D', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStore(() => 'tag' as const, { defaultValue: 'fallback' }), {
      wrapper: makeWrapper(store)
    });
    const [value] = result.current;

    expectTypeOf(value).toEqualTypeOf<string>();
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
