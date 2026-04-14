/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useRef, useMemo, useSyncExternalStore } from 'react';

import {
  makeMultiSnapshot,
  makeSingleSnapshot,
  pathOf,
  useMultiExternalStore,
  useMultiSetters,
  useMultiSubscribe,
  useResolvedStore
} from './shared';
import shallowEqual from '../helpers/shallowEqual';
import useIsomorphicLayoutEffect from '../helpers/useIsomorphicLayoutEffect';

import type {
  MultiPathReturn,
  PathOf,
  PathValue,
  PathValues,
  StoreApi,
  UseStoreSyncMultiOptions,
  UseStoreSyncOptions
} from '../../types/StoreTypes';

export type { UseStoreSyncOptions, UseStoreSyncMultiOptions };

function useStoreSyncMulti<TState extends object, const Paths extends ReadonlyArray<PathOf<TState>>>(
  store: StoreApi<TState>,
  paths: Paths,
  values: PathValues<TState, Paths>,
  options: UseStoreSyncMultiOptions<TState>
): MultiPathReturn<TState, Paths> {
  const { mode = 'sync', enabled = true, syncStrategy = 'afterRender', canListen = false } = options;
  const pathsKey = paths.join('|');

  const mountedRef = useRef(false);
  const isFirstRender = !mountedRef.current;
  mountedRef.current = true;

  const lastSyncedRef = useRef<readonly unknown[] | undefined>(undefined);

  const shouldSync =
    enabled &&
    (isFirstRender ||
      (mode === 'sync' && (values as unknown[]).some((v, i) => !Object.is(lastSyncedRef.current?.[i], v))));

  const runSync = () => {
    lastSyncedRef.current = values as unknown[];
    paths.forEach((p, i) => {
      store.setState(p, (values as unknown[])[i] as PathValue<TState, typeof p>);
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

  const lastRef = useRef<unknown[] | null>(null);

  const getSnapshot = useMemo(
    () => makeMultiSnapshot(store, paths, lastRef),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, pathsKey]
  );

  const subscribe = useMultiSubscribe(store, paths, pathsKey, enabled, mode, canListen);
  const selected = useMultiExternalStore(subscribe, getSnapshot, enabled, lastRef);
  const setters = useMultiSetters(store, paths, pathsKey);

  return [selected, ...setters] as unknown as MultiPathReturn<TState, Paths>;
}

function useStoreSyncSingle<TState extends object, P extends PathOf<TState>>(
  store: StoreApi<TState>,
  path: P | ((state: TState) => P) | undefined,
  value: PathValue<TState, P> | TState,
  options: UseStoreSyncOptions<PathValue<TState, P> | TState, any>
): [unknown, (value: unknown) => void] {
  const isFullState = path === undefined;
  const isDynamicPath = typeof path === 'function';
  const defaultEq = isFullState ? shallowEqual : Object.is;
  const {
    mode = 'sync',
    enabled = true,
    equalityFn = defaultEq,
    syncStrategy = 'afterRender',
    canListen = true
  } = options;

  const lastSyncedRef = useRef<typeof value | undefined>(undefined);
  const mountedRef = useRef(false);
  const isFirstRender = !mountedRef.current;
  mountedRef.current = true;

  const shouldSync =
    enabled &&
    (isFirstRender || (mode === 'sync' && !equalityFn(lastSyncedRef.current as PathValue<TState, P>, value)));

  const runSync = (canPropagate = true) => {
    lastSyncedRef.current = value;
    if (isFullState) {
      store.setState(undefined, prev => ({ ...prev, ...value }), canPropagate);
    } else if (isDynamicPath) {
      const resolvedPath = (path as (state: TState) => P)(store.getState());
      store.setState(resolvedPath, value as PathValue<TState, P>, canPropagate);
    } else {
      store.setState(path, value as PathValue<TState, P>, canPropagate);
    }
  };

  const getSnapshot = useMemo(
    () =>
      makeSingleSnapshot(
        store,
        isFullState ? undefined : isDynamicPath ? pathOf(path as (state: TState) => PathOf<TState>) : path
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, path]
  );

  const subscribe = useMemo(
    () =>
      (cb: () => void): (() => void) => {
        if (!enabled || !canListen) {
          return () => {};
        }

        if (isFullState || isDynamicPath) {
          return store.subscribe(cb);
        }

        return store.subscribePath(path as PathOf<TState>, cb);
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, path, enabled, canListen]
  );

  const lastSelectedRef = useRef(getSnapshot());

  const getSnap = () => {
    if (!enabled) {
      return lastSelectedRef.current;
    }

    const next = getSnapshot();
    if ((equalityFn as (a: unknown, b: unknown) => boolean)(lastSelectedRef.current, next)) {
      return lastSelectedRef.current;
    }

    lastSelectedRef.current = next;
    return next;
  };

  const selected = useSyncExternalStore(subscribe, getSnap, getSnap);

  const setState = useCallback(
    (v: unknown) => {
      if (isFullState) {
        store.setState(undefined, v as TState);
      } else if (isDynamicPath) {
        const resolved = (path as (state: TState) => P)(store.getState());
        store.setState(resolved, v as PathValue<TState, P>);
      } else {
        store.setState(path as PathOf<TState>, v as PathValue<TState, P>);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, path]
  );

  if (syncStrategy === 'render') {
    if (shouldSync && selected !== value) {
      runSync();
    }
  } else {
    if (shouldSync && isFirstRender && selected !== value) {
      runSync(false);
    }

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useIsomorphicLayoutEffect(() => {
      if (shouldSync && !isFirstRender) {
        runSync();
      }
    }, [shouldSync, value, path]);
  }

  return [selected, setState];
}

function useStoreSync<TState extends object>(
  path: undefined,
  value: TState | Partial<TState>,
  options?: UseStoreSyncOptions<TState, TState>
): [TState, (value: TState | ((prev: TState) => TState)) => void];

function useStoreSync<TState extends object, P extends PathOf<TState>>(
  path: P | ((state: TState) => P),
  value: PathValue<TState, P>,
  options?: UseStoreSyncOptions<PathValue<TState, P>, TState>
): [
  PathValue<TState, P>,
  (value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)) => void
];

function useStoreSync<TState extends object, const Paths extends ReadonlyArray<PathOf<TState>>>(
  paths: Paths,
  values: PathValues<TState, Paths>,
  options?: UseStoreSyncMultiOptions<TState>
): MultiPathReturn<TState, Paths>;

function useStoreSync<TState extends object, P extends PathOf<TState>>(
  pathOrPaths: P | ((state: TState) => P) | ReadonlyArray<PathOf<TState>> | undefined,
  value: PathValue<TState, P> | TState | PathValues<TState, ReadonlyArray<PathOf<TState>>>,
  options: UseStoreSyncOptions<any, any> | UseStoreSyncMultiOptions<TState> = {}
): unknown {
  const store = useResolvedStore(
    (options as UseStoreSyncOptions<any, any>).store as StoreApi<TState> | undefined,
    'useStoreSync'
  );

  if (Array.isArray(pathOrPaths)) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useStoreSyncMulti(
      store,
      pathOrPaths as ReadonlyArray<PathOf<TState>>,
      value as PathValues<TState, ReadonlyArray<PathOf<TState>>>,
      options as UseStoreSyncMultiOptions<TState>
    );
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useStoreSyncSingle(
    store,
    pathOrPaths as P | ((state: TState) => P) | undefined,
    value as PathValue<TState, P> | TState,
    options as UseStoreSyncOptions<PathValue<TState, P> | TState, any>
  );
}

export default useStoreSync;
