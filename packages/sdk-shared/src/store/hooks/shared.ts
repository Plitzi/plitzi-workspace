/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { use, useMemo, useSyncExternalStore } from 'react';

import { StoreContext } from '../StoreProvider';

import type { PathOf, StoreApi, SyncMode } from '../../types/StoreTypes';
import type { RefObject } from 'react';

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
  mode: SyncMode
): (cb: () => void) => () => void {
  return useMemo(
    () => (cb: () => void) => {
      if (!enabled || mode === 'mount') {
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
  return useSyncExternalStore(subscribe, () => {
    if (!enabled) {
      const snap = lastRef.current ?? getSnapshot();
      lastRef.current = snap;

      return snap;
    }

    return getSnapshot();
  });
}
