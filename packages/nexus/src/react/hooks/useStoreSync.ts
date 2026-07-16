/* eslint-disable @typescript-eslint/no-explicit-any */

import { useRef } from 'react';

import { useResolvedStore } from './shared';
import shallowEqual from '../../helpers/shallowEqual';
import useIsomorphicLayoutEffect from '../useIsomorphicLayoutEffect';

import type {
  PathOf,
  PathOrFn,
  PathValue,
  PathValues,
  StoreApi,
  UseStoreSyncMultiOptions,
  UseStoreSyncOptions
} from '../../types';

export type { UseStoreSyncOptions, UseStoreSyncMultiOptions };

function useStoreSyncMulti<TState extends object>(
  store: StoreApi<TState>,
  paths: ReadonlyArray<PathOrFn<TState>>,
  values: readonly unknown[],
  options: UseStoreSyncMultiOptions<TState>
): void {
  const { mode = 'sync', enabled = true, syncStrategy = 'afterRender' } = options;
  const pathsKey = paths.map((p, i) => (typeof p === 'function' ? `fn_${i}` : p)).join('|');

  const mountedRef = useRef(false);
  const isFirstRender = !mountedRef.current;
  mountedRef.current = true;

  const lastSyncedRef = useRef<readonly unknown[] | undefined>(undefined);

  const shouldSync =
    enabled && (isFirstRender || (mode === 'sync' && values.some((v, i) => !Object.is(lastSyncedRef.current?.[i], v))));

  const runSync = () => {
    lastSyncedRef.current = values;
    // One wake pass for the whole multi-path sync instead of one per path.
    store.batch(() => {
      paths.forEach((p, i) => {
        const resolvedPath = typeof p === 'function' ? p(store.getState()) : p;
        store.setState(resolvedPath, values[i] as PathValue<TState, PathOf<TState>>);
      });
    });
  };

  if (syncStrategy === 'render') {
    if (shouldSync) {
      runSync();
    }
  } else {
    if (shouldSync && isFirstRender) {
      runSync();
    }

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useIsomorphicLayoutEffect(() => {
      if (shouldSync && !isFirstRender) {
        runSync();
      }
    }, [shouldSync, values, pathsKey]);
  }
}

function useStoreSyncSingle<TState extends object, P extends PathOf<TState>>(
  store: StoreApi<TState>,
  path: P | ((state: TState) => P) | undefined,
  value: PathValue<TState, P> | TState,
  options: UseStoreSyncOptions<PathValue<TState, P> | TState, any>
): void {
  const isFullState = path === undefined;
  const isDynamicPath = typeof path === 'function';
  const defaultEq = isFullState ? shallowEqual : Object.is;
  const { mode = 'sync', enabled = true, equalityFn = defaultEq, syncStrategy = 'afterRender' } = options;

  const lastSyncedRef = useRef<typeof value | undefined>(undefined);
  const mountedRef = useRef(false);
  const isFirstRender = !mountedRef.current;
  mountedRef.current = true;

  const lastSynced = lastSyncedRef.current;
  const shouldSync =
    enabled && (isFirstRender || (mode === 'sync' && (lastSynced === undefined || !equalityFn(lastSynced, value))));

  const runSync = (canPropagate = true) => {
    lastSyncedRef.current = value;
    if (isFullState) {
      store.setState(undefined, prev => ({ ...prev, ...value }), { canPropagate });
    } else if (isDynamicPath) {
      const resolvedPath = path(store.getState());
      store.setState(resolvedPath, value as PathValue<TState, P>, { canPropagate });
    } else {
      store.setState(path, value as PathValue<TState, P>, { canPropagate });
    }
  };

  if (syncStrategy === 'render') {
    if (shouldSync) {
      runSync();
    }
  } else {
    if (shouldSync && isFirstRender) {
      runSync(false);
    }

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useIsomorphicLayoutEffect(() => {
      if (shouldSync && !isFirstRender) {
        runSync();
      }
    }, [shouldSync, value, path]);
  }
}

function useStoreSync<TState extends object>(
  path: undefined,
  value: TState | Partial<TState>,
  options?: UseStoreSyncOptions<TState, TState>
): void;

function useStoreSync<TState extends object, P extends PathOf<TState>>(
  path: P | ((state: TState) => P),
  value: PathValue<TState, P>,
  options?: UseStoreSyncOptions<PathValue<TState, P>, TState>
): void;

function useStoreSync<TState extends object, const Paths extends ReadonlyArray<PathOf<TState>>>(
  paths: Paths,
  values: PathValues<TState, Paths>,
  options?: UseStoreSyncMultiOptions<TState>
): void;

function useStoreSync<TState extends object>(
  paths: ReadonlyArray<PathOrFn<TState>>,
  values: readonly unknown[],
  options?: UseStoreSyncMultiOptions<TState>
): void;

function useStoreSync<TState extends object, P extends PathOf<TState>>(
  pathOrPaths: P | ((state: TState) => P) | ReadonlyArray<PathOrFn<TState>> | undefined,
  value: PathValue<TState, P> | TState | readonly unknown[],
  options: UseStoreSyncOptions<any, any> | UseStoreSyncMultiOptions<TState> = {}
): void {
  const syncOptions = options as UseStoreSyncOptions<any, any>;
  const store = useResolvedStore(syncOptions.store, 'useStoreSync', syncOptions.storeId);

  if (Array.isArray(pathOrPaths)) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useStoreSyncMulti(
      store,
      pathOrPaths as ReadonlyArray<PathOrFn<TState>>,
      value as readonly unknown[],
      options as UseStoreSyncMultiOptions<TState>
    );
    return;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useStoreSyncSingle(
    store,
    pathOrPaths as P | ((state: TState) => P) | undefined,
    value as PathValue<TState, P> | TState,
    options as UseStoreSyncOptions<PathValue<TState, P> | TState, any>
  );
}

export default useStoreSync;
