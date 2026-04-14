/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { use, useCallback, useMemo, useSyncExternalStore } from 'react';

import getByPath from '../helpers/getByPath';
import { StoreContext } from '../StoreProvider';

import type { PathOf, StoreApi, SyncMode } from '../../types/StoreTypes';
import type { RefObject } from 'react';

// ─── Shared equality ─────────────────────────────────────────────────────────

export const defaultMultiEqualityFn = (a: unknown[], b: unknown[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) {
      return false;
    }
  }

  return true;
};

// ─── Snapshot factories ───────────────────────────────────────────────────────

/**
 * Creates a `getSnapshot` function for a single path, selector, or full state.
 * Used by both `useStore` and `useStoreSync` so the logic lives in one place.
 */
export function makeSingleSnapshot<TState extends object>(
  store: StoreApi<TState>,
  pathOrSelector: PathOf<TState> | ((state: TState) => unknown) | undefined,
  defaultValue?: unknown
): () => unknown {
  return () => {
    const state = store.getState();

    if (typeof pathOrSelector === 'function') {
      return pathOrSelector(state);
    }

    if (typeof pathOrSelector === 'string') {
      const val = getByPath(state, pathOrSelector);

      return val === undefined ? defaultValue : val;
    }

    return state;
  };
}

/**
 * Creates a `getSnapshot` function for multiple paths.
 * Used by both `useStore` and `useStoreSync` so the logic lives in one place.
 */
export function makeMultiSnapshot<TState extends object>(
  store: StoreApi<TState>,
  paths: ReadonlyArray<PathOf<TState>>,
  lastRef: RefObject<unknown[] | null>,
  options: {
    equalityFn?: (a: unknown[], b: unknown[]) => boolean;
    defaultValue?: unknown;
  } = {}
): () => unknown[] {
  const { equalityFn = defaultMultiEqualityFn, defaultValue } = options;

  return () => {
    const state = store.getState();

    const next = paths.map((p, i) => {
      const val = getByPath(state, p);
      if (val !== undefined || defaultValue === undefined) {
        return val;
      }

      if (Array.isArray(defaultValue)) {
        const def = (defaultValue as unknown[])[i];

        return def !== undefined ? def : val;
      }

      return defaultValue;
    });

    const prev = lastRef.current;
    if (prev !== null && equalityFn(prev, next)) {
      return prev;
    }

    lastRef.current = next;

    return next;
  };
}

/**
 * Resolves the store from an explicit option or the nearest StoreContext.
 * Throws if neither is available.
 */
export function useResolvedStore<TState extends object>(
  optionStore: StoreApi<TState> | undefined,
  hookName: string
): StoreApi<TState> {
  const contextStore = use(StoreContext) as StoreApi<TState> | undefined;
  const store = optionStore ?? contextStore;
  if (!store) {
    throw new Error(`${hookName} must be used inside a StoreProvider`);
  }

  return store;
}

/**
 * Stable subscribe function for multi-path hooks.
 * Returns a no-op when disabled or in mount mode.
 */
export function useMultiSubscribe<TState extends object>(
  store: StoreApi<TState>,
  paths: ReadonlyArray<PathOf<TState>>,
  pathsKey: string,
  enabled: boolean,
  mode: SyncMode,
  canListen: boolean = false
): (cb: () => void) => () => void {
  return useMemo(
    () => (cb: () => void) => {
      if (!enabled || mode === 'mount' || !canListen) {
        return () => {};
      }

      const unsubs = paths.map(p => store.subscribePath(p, cb));

      return () => unsubs.forEach(u => u());
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, pathsKey, enabled, mode]
  );
}

/**
 * Stable setter array for multi-path hooks.
 */
export function useMultiSetters<TState extends object>(
  store: StoreApi<TState>,
  paths: ReadonlyArray<PathOf<TState>>,
  pathsKey: string
): Array<(value: any) => void> {
  return useMemo(
    () => paths.map(p => (value: any) => store.setState(p, value)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, pathsKey]
  );
}

/**
 * useSyncExternalStore wrapper for multi-path hooks.
 * When disabled, freezes at the first-seen snapshot.
 */
export function useMultiExternalStore(
  subscribe: (cb: () => void) => () => void,
  getSnapshot: () => unknown[],
  enabled: boolean,
  lastRef: RefObject<unknown[] | null>
): unknown[] {
  const getSnapshotFn = useCallback(() => {
    if (!enabled) {
      const snap = lastRef.current ?? getSnapshot();
      lastRef.current = snap;

      return snap;
    }

    return getSnapshot();
  }, [enabled, getSnapshot, lastRef]);

  return useSyncExternalStore(subscribe, getSnapshotFn, getSnapshotFn);
}
