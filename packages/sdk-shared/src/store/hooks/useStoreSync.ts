/* eslint-disable @typescript-eslint/no-explicit-any */

import { use, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';

import getByPath from '../helpers/getByPath';
import shallowEqual from '../helpers/shallowEqual';
import useIsomorphicLayoutEffect from '../helpers/useIsomorphicLayoutEffect';
import { StoreContext } from '../StoreProvider';

import type { MultiPathReturn } from './useStore';
import type {
  PathOf,
  PathValue,
  PathValues,
  StoreApi,
  StoreHookBaseOptions,
  StoreHookReactiveOptions,
  SyncMode
} from '../../types/StoreTypes';

export type UseStoreSyncOptions<T, TState extends object = object> = StoreHookReactiveOptions<T, TState> & {
  syncStrategy?: 'render' | 'afterRender';
};

export type UseStoreSyncMultiOptions<TState extends object = object> = StoreHookBaseOptions<TState> & {
  mode?: SyncMode;
  enabled?: boolean;
  syncStrategy?: 'render' | 'afterRender';
};

export type UseStoreSyncReturn<TState extends object, P extends PathOf<TState> | undefined> =
  P extends PathOf<TState>
    ? [
        PathValue<TState, P>,
        (value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)) => void
      ]
    : [TState, (value: TState | ((prev: TState) => TState)) => void];

// ─── useStoreSyncMulti ────────────────────────────────────────────────────────

function useStoreSyncMulti<TState extends object, const Paths extends ReadonlyArray<PathOf<TState>>>(
  store: StoreApi<TState>,
  paths: Paths,
  values: PathValues<TState, Paths>,
  options: UseStoreSyncMultiOptions<TState>
): MultiPathReturn<TState, Paths> {
  const { mode = 'sync', enabled = true, syncStrategy = 'afterRender' } = options;
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
      if (shouldSync) {
        runSync();
      }
    }, [shouldSync, values, pathsKey]);
  }

  const lastRef = useRef<unknown[] | null>(null);

  const getSnapshot = useCallback((): unknown[] => {
    const state = store.getState();
    const next = paths.map(p => getByPath(state, p));
    const prev = lastRef.current;

    if (prev !== null && next.every((v, i) => Object.is(v, prev[i]))) {
      return prev;
    }

    lastRef.current = next;
    return next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, pathsKey]);

  const subscribe = useMemo(
    () =>
      (cb: () => void): (() => void) => {
        if (!enabled || mode === 'mount') {
          return () => {};
        }

        const unsubs = paths.map(p => store.subscribePath(p, cb));
        return () => unsubs.forEach(u => u());
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, pathsKey, enabled, mode]
  );

  const selected = useSyncExternalStore(subscribe, () => {
    if (!enabled) {
      if (lastRef.current === null) {
        lastRef.current = getSnapshot();
      }
      return lastRef.current;
    }
    return getSnapshot();
  });

  const setters = useMemo(
    () =>
      paths.map(
        p =>
          (value: PathValue<TState, typeof p> | ((prev: PathValue<TState, typeof p>) => PathValue<TState, typeof p>)) =>
            store.setState(p, value)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, pathsKey]
  );

  return [selected, ...setters] as unknown as MultiPathReturn<TState, Paths>;
}

// ─── useStoreSyncSingle ───────────────────────────────────────────────────────

function useStoreSyncSingle<TState extends object, P extends PathOf<TState>>(
  store: StoreApi<TState>,
  path: P | undefined,
  value: PathValue<TState, P> | TState,
  options: UseStoreSyncOptions<PathValue<TState, P> | TState, any>
): [unknown, (value: unknown) => void] {
  const isFullState = path === undefined;
  const defaultEq = isFullState ? shallowEqual : Object.is;
  const { mode = 'sync', enabled = true, equalityFn = defaultEq, syncStrategy = 'afterRender' } = options;

  const lastSyncedRef = useRef<typeof value | undefined>(undefined);
  const mountedRef = useRef(false);

  const isFirstRender = !mountedRef.current;
  mountedRef.current = true;

  const shouldSync =
    enabled &&
    (isFirstRender || (mode === 'sync' && !equalityFn(lastSyncedRef.current as PathValue<TState, P>, value)));

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
  } else {
    if (shouldSync && isFirstRender) {
      runSync();
    }

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

// ─── useStoreSync ─────────────────────────────────────────────────────────────

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

function useStoreSync<TState extends object, const Paths extends ReadonlyArray<PathOf<TState>>>(
  paths: Paths,
  values: PathValues<TState, Paths>,
  options?: UseStoreSyncMultiOptions<TState>
): MultiPathReturn<TState, Paths>;

function useStoreSync<TState extends object, P extends PathOf<TState>>(
  pathOrPaths: P | ReadonlyArray<PathOf<TState>> | undefined,
  value: PathValue<TState, P> | TState | PathValues<TState, ReadonlyArray<PathOf<TState>>>,
  options: UseStoreSyncOptions<any, any> | UseStoreSyncMultiOptions<TState> = {}
): unknown {
  const contextStore = use(StoreContext) as StoreApi<TState> | undefined;
  const store = ((options as UseStoreSyncOptions<any, any>).store as StoreApi<TState> | undefined) ?? contextStore;
  if (!store) {
    throw new Error('useStoreSync must be used inside a StoreProvider');
  }

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
    pathOrPaths as P | undefined,
    value as PathValue<TState, P> | TState,
    options as UseStoreSyncOptions<PathValue<TState, P> | TState, any>
  );
}

export default useStoreSync;
