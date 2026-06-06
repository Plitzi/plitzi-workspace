/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useContext, useCallback, useMemo, useSyncExternalStore } from 'react';

import getByPath from '../../helpers/getByPath';
import { findStoreInRegistry, StoreContext, StoreRegistryContext } from '../../StoreContext';

import type { PathOf, PathOrFn, StoreApi, SyncMode } from '../../types';
import type { RefObject } from 'react';

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

export function makeSingleSnapshot<TState extends object>(
  store: StoreApi<TState>,
  pathOrFn: PathOf<TState> | ((state: TState) => PathOf<TState>) | undefined,
  defaultValue?: unknown
): () => unknown {
  return () => {
    if (typeof pathOrFn === 'string') {
      const val = store.getPath(pathOrFn);
      return val === undefined ? defaultValue : val;
    }

    if (typeof pathOrFn === 'function') {
      const state = store.getState();
      const val = getByPath(state, pathOrFn(state));
      return val === undefined ? defaultValue : val;
    }

    return store.getState();
  };
}

export function makeMultiSnapshot<TState extends object>(
  store: StoreApi<TState>,
  pathsRef: RefObject<ReadonlyArray<PathOrFn<TState>>>,
  lastRef: RefObject<unknown[] | null>,
  options: { equalityFn?: (a: unknown[], b: unknown[]) => boolean; defaultValue?: unknown } = {}
): () => unknown[] {
  const { equalityFn = defaultMultiEqualityFn, defaultValue } = options;

  return () => {
    const paths = pathsRef.current;
    const needsState = paths.some(p => typeof p === 'function');
    const state = needsState ? store.getState() : (undefined as unknown as TState);
    const next = paths.map((p, i) => {
      const val = typeof p === 'function' ? getByPath(state, p(state)) : store.getPath(p);
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

export function useResolvedStore<TState extends object>(
  optionStore: StoreApi<TState> | undefined,
  hookName: string,
  storeId?: string
): StoreApi<TState> {
  const contextStore = useContext(StoreContext) as StoreApi<TState> | undefined;
  const registry = useContext(StoreRegistryContext);

  // An explicit `store` wins; then a `storeId` resolved from the registry (reachable across disconnected providers);
  // otherwise the nearest provider's store.
  if (optionStore) {
    return optionStore;
  }

  if (storeId !== undefined) {
    const byId = findStoreInRegistry(registry, storeId) as StoreApi<TState> | undefined;
    if (!byId) {
      throw new Error(`${hookName}: no store registered with id "${storeId}" in any ancestor StoreProvider`);
    }

    return byId;
  }

  if (!contextStore) {
    throw new Error(`${hookName} must be used inside a StoreProvider`);
  }

  return contextStore;
}

export function useMultiSubscribe<TState extends object>(
  store: StoreApi<TState>,
  pathsRef: RefObject<ReadonlyArray<PathOrFn<TState>>>,
  pathsKey: string,
  enabled: boolean,
  mode: SyncMode
): (cb: () => void) => () => void {
  return useMemo(
    () => (cb: () => void) => {
      if (!enabled || mode === 'mount') {
        return () => {};
      }

      const paths = pathsRef.current;
      if (paths.some(p => typeof p === 'function')) {
        return store.subscribe(cb);
      }

      const unsubs = paths.map(p => store.subscribePath(p as PathOf<TState>, cb));

      return () => unsubs.forEach(u => u());
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, pathsKey, enabled, mode]
  );
}

export function useMultiSetters<TState extends object>(
  store: StoreApi<TState>,
  pathsRef: RefObject<ReadonlyArray<PathOrFn<TState>>>,
  pathsKey: string
): Array<(value: any) => void> {
  const length = pathsRef.current.length;

  return useMemo(
    () =>
      Array.from({ length }, (_, i) => (value: any) => {
        const p = pathsRef.current[i];
        const resolvedPath = typeof p === 'function' ? p(store.getState()) : p;
        store.setState(resolvedPath, value);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, pathsKey]
  );
}

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
