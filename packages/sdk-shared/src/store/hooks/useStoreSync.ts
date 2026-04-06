import { use, useCallback, useMemo, useRef, useSyncExternalStore, useLayoutEffect, useEffect } from 'react';

import getByPath from '../helpers/getByPath';
import shallowEqual from '../helpers/shallowEqual';
import { StoreContext } from '../StoreProvider';

import type { PathOf, PathValue, StoreApi, SyncMode } from '../../types/StoreTypes';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export type UseStoreSyncOptions<T> = {
  mode?: SyncMode;
  enabled?: boolean;
  equalityFn?: (a: T, b: T) => boolean;
  syncStrategy?: 'render' | 'afterRender';
};

export type UseStoreSyncReturn<TState extends object, P extends PathOf<TState> | undefined> =
  P extends PathOf<TState>
    ? [
        PathValue<TState, P>,
        (value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)) => void
      ]
    : [TState, (value: TState | ((prev: TState) => TState)) => void];

function useStoreSync<TState extends object>(
  path: undefined,
  value: TState | Partial<TState>,
  options?: UseStoreSyncOptions<TState>
): [TState, (value: TState | ((prev: TState) => TState)) => void];

function useStoreSync<TState extends object, P extends PathOf<TState>>(
  path: P,
  value: PathValue<TState, P>,
  options?: UseStoreSyncOptions<PathValue<TState, P>>
): [
  PathValue<TState, P>,
  (value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)) => void
];

function useStoreSync<TState extends object, P extends PathOf<TState>>(
  path: P | undefined,
  value: PathValue<TState, P> | TState,
  options: UseStoreSyncOptions<PathValue<TState, P> | TState> = {}
): [unknown, (value: unknown) => void] {
  const store = use(StoreContext) as StoreApi<TState> | undefined;
  if (!store) {
    throw new Error('useStoreSync must be used inside a StoreProvider');
  }

  const isFullState = path === undefined;
  const defaultEq = isFullState ? shallowEqual : Object.is;
  const { mode = 'sync', enabled = true, equalityFn = defaultEq, syncStrategy = 'afterRender' } = options;

  const lastSyncedRef = useRef<typeof value | undefined>(undefined);
  const mountedRef = useRef(false);

  const shouldSync =
    enabled &&
    (!mountedRef.current || (mode === 'sync' && !equalityFn(lastSyncedRef.current as PathValue<TState, P>, value)));

  const runSync = () => {
    lastSyncedRef.current = value;
    if (isFullState) {
      store.setState(undefined, prev => ({ ...prev, ...value }));
    } else {
      store.setState(path, value as PathValue<TState, P>);
    }
  };

  if (syncStrategy === 'render') {
    if (shouldSync) {
      runSync();
    }

    mountedRef.current = true;
  } else {
    if (shouldSync && !mountedRef.current) {
      runSync();
    }

    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useIsomorphicLayoutEffect(() => {
      if (shouldSync) {
        runSync();
      }
    }, [shouldSync, value, path]);
  }

  const getSnapshot = useMemo(
    () => (): unknown => (isFullState ? store.getState() : getByPath(store.getState(), path as PathOf<TState>)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, path]
  );

  const subscribe = useMemo(
    () =>
      (cb: () => void): (() => void) => {
        if (!enabled) {
          return () => {};
        }

        if (isFullState) {
          return store.subscribe(cb);
        }

        return store.subscribePath(path as PathOf<TState>, cb);
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, path, enabled]
  );

  const lastSelectedRef = useRef<unknown>(getSnapshot());

  const selected = useSyncExternalStore(subscribe, () => {
    if (!enabled) {
      return lastSelectedRef.current;
    }

    const next = getSnapshot();
    if ((equalityFn as (a: unknown, b: unknown) => boolean)(lastSelectedRef.current, next)) {
      return lastSelectedRef.current;
    }

    lastSelectedRef.current = next;

    return next;
  });

  const setState = useCallback(
    (v: unknown) => {
      if (isFullState) {
        store.setState(undefined, v as TState);
      } else {
        store.setState(path as PathOf<TState>, v as PathValue<TState, P>);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, path]
  );

  return [selected, setState];
}

export default useStoreSync;
