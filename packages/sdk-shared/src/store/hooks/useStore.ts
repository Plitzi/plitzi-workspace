/* eslint-disable @typescript-eslint/no-explicit-any */

import { use, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';

import getByPath from '../helpers/getByPath';
import shallowEqual from '../helpers/shallowEqual';
import { StoreContext } from '../StoreProvider';

import type { PathOf, PathValue, StoreApi } from '../../types/StoreTypes';

type PathSetter<TState extends object, P extends PathOf<TState>> = (
  value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)
) => void;

type PathValues<TState extends object, Paths extends ReadonlyArray<PathOf<TState>>> = {
  [I in keyof Paths]: Paths[I] extends PathOf<TState> ? PathValue<TState, Paths[I]> : never;
};

type PathSetters<TState extends object, Paths extends ReadonlyArray<PathOf<TState>>> = {
  [I in keyof Paths]: Paths[I] extends PathOf<TState> ? PathSetter<TState, Paths[I]> : never;
};

export type MultiPathReturn<TState extends object, Paths extends ReadonlyArray<PathOf<TState>>> = [
  PathValues<TState, Paths>,
  ...PathSetters<TState, Paths>
];

export type UseStoreReturn<TState extends object, TArg> =
  TArg extends PathOf<TState>
    ? [PathValue<TState, TArg>, PathSetter<TState, TArg>]
    : TArg extends (state: TState) => infer TSelected
      ? [TSelected, StoreApi<TState>['setState']]
      : [TState, StoreApi<TState>['setState']];

export type UseStoreOptions<T> = {
  mode?: 'sync' | 'mount';
  enabled?: boolean;
  equalityFn?: (a: T, b: T) => boolean;
  defaultValue?: NonNullable<T>;
};

export type UseStoreMultiOptions<TState extends object, Paths extends ReadonlyArray<PathOf<TState>>> = UseStoreOptions<{
  [K in Paths[number]]?: PathValue<TState, K>;
}>;

function useSingleStore<TState extends object, TArg extends PathOf<TState> | ((state: TState) => unknown) | undefined>(
  store: StoreApi<TState>,
  pathOrSelector: TArg,
  options: UseStoreOptions<unknown>
): UseStoreReturn<TState, TArg> {
  const { mode = 'sync', enabled = true, defaultValue } = options;
  const defaultEq = typeof pathOrSelector === 'function' ? shallowEqual : Object.is;
  const equalityFn = options.equalityFn ?? defaultEq;

  const getSnapshot = useCallback((): unknown => {
    const state = store.getState();
    if (typeof pathOrSelector === 'function') {
      return (pathOrSelector as (s: TState) => unknown)(state);
    }

    if (typeof pathOrSelector === 'string') {
      const val = getByPath(state, pathOrSelector as PathOf<TState>);

      return val === undefined ? defaultValue : val;
    }

    return state;
  }, [store, pathOrSelector, defaultValue]);

  const lastRef = useRef<unknown>(getSnapshot());

  const subscribe = useMemo(
    () =>
      (cb: () => void): (() => void) => {
        if (!enabled || mode === 'mount') {
          return () => {};
        }

        if (typeof pathOrSelector === 'string') {
          return store.subscribePath(pathOrSelector as PathOf<TState>, cb);
        }

        return store.subscribe(cb);
      },
    [enabled, mode, pathOrSelector, store]
  );

  const selected = useSyncExternalStore(subscribe, () => {
    if (!enabled) {
      return lastRef.current;
    }

    if (mode === 'mount') {
      return getSnapshot();
    }

    const next = getSnapshot();
    if (equalityFn(lastRef.current, next)) {
      return lastRef.current;
    }

    lastRef.current = next;

    return next;
  });

  const setState = useCallback(
    (value: unknown) => {
      if (typeof pathOrSelector === 'string') {
        store.setState(pathOrSelector as PathOf<TState>, value as PathValue<TState, PathOf<TState>>);
      } else {
        store.setState(undefined, value as TState);
      }
    },
    [store, pathOrSelector]
  );

  return [selected, setState] as UseStoreReturn<TState, TArg>;
}

function useMultiStore<TState extends object, const Paths extends ReadonlyArray<PathOf<TState>>>(
  store: StoreApi<TState>,
  paths: Paths,
  options: UseStoreMultiOptions<TState, Paths>
): MultiPathReturn<TState, Paths> {
  const { mode = 'sync', enabled = true, equalityFn = Object.is, defaultValue } = options;
  const pathsKey = paths.join('|');

  const lastRef = useRef<PathValues<TState, Paths> | null>(null);

  const getSnapshot = useCallback((): PathValues<TState, Paths> => {
    const state = store.getState();
    let changed = lastRef.current === null;

    if (!changed) {
      for (let i = 0; i < paths.length; i++) {
        if (!Object.is((lastRef.current as unknown[])[i], getByPath(state, paths[i]))) {
          changed = true;
          break;
        }
      }
    }

    if (!changed) {
      return lastRef.current as PathValues<TState, Paths>;
    }

    // Point 3: apply per-path defaultValue for multi-path
    const next = paths.map(p => {
      const val = getByPath(state, p);
      if (val === undefined && defaultValue && p in (defaultValue as object)) {
        return defaultValue[p];
      }

      return val;
    }) as PathValues<TState, Paths>;

    if (lastRef.current !== null && equalityFn(lastRef.current, next)) {
      return lastRef.current;
    }

    lastRef.current = next;

    return next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, pathsKey, equalityFn, defaultValue]);

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
    if (!enabled && lastRef.current === null) {
      lastRef.current = getSnapshot();

      return lastRef.current;
    }

    if (!enabled) {
      return lastRef.current;
    }

    if (mode === 'mount') {
      return getSnapshot();
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

function useStore<TState extends object>(
  arg?: undefined,
  options?: UseStoreOptions<TState>
): [TState, StoreApi<TState>['setState']];

function useStore<TState extends object, P extends PathOf<TState>>(
  path: P,
  options?: UseStoreOptions<PathValue<TState, P>> & { defaultValue?: never }
): [PathValue<TState, P>, PathSetter<TState, P>];

function useStore<TState extends object, P extends PathOf<TState>>(
  path: P,
  options: UseStoreOptions<NonNullable<PathValue<TState, P>>> & { defaultValue: NonNullable<PathValue<TState, P>> }
): [NonNullable<PathValue<TState, P>>, PathSetter<TState, P>];

function useStore<TState extends object, TSelected>(
  selector: (state: TState) => TSelected,
  options?: UseStoreOptions<TSelected>
): [TSelected, StoreApi<TState>['setState']];

function useStore<TState extends object, const Paths extends ReadonlyArray<PathOf<TState>>>(
  paths: Paths,
  options?: UseStoreMultiOptions<TState, Paths>
): MultiPathReturn<TState, Paths>;

function useStore<TState extends object>(
  arg?: PathOf<TState> | ReadonlyArray<PathOf<TState>> | ((state: TState) => unknown),
  options: UseStoreOptions<any> = {}
): unknown {
  const store = use(StoreContext) as StoreApi<TState> | undefined;
  if (!store) {
    throw new Error('useStore must be used inside a StoreProvider');
  }

  if (Array.isArray(arg)) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useMultiStore(store, arg as ReadonlyArray<PathOf<TState>>, options);
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useSingleStore(store, arg as PathOf<TState> | ((state: TState) => unknown) | undefined, options);
}

export default useStore;
