/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';

import {
  defaultMultiEqualityFn,
  isPathResolver,
  makeMultiSnapshot,
  makeSingleSnapshot,
  useMultiExternalStore,
  useMultiSetters,
  useMultiSubscribe,
  useResolvedStore
} from './shared';
import shallowEqual from '../helpers/shallowEqual';

import type {
  __NoDefault,
  MultiPathReturn,
  PathOf,
  PathResolverFn,
  PathSetter,
  PathSetters,
  PathValue,
  PathValues,
  StoreApi,
  UseStoreMultiOptions,
  UseStoreOptions,
  UseStoreReturn
} from '../../types/StoreTypes';

export { defaultMultiEqualityFn, pathOf } from './shared';
export type { MultiPathReturn, UseStoreOptions, UseStoreMultiOptions, UseStoreReturn, PathResolverFn };

function useSingleStore<TState extends object, TArg extends PathOf<TState> | ((state: TState) => unknown) | undefined>(
  store: StoreApi<TState>,
  pathOrSelector: TArg,
  options: UseStoreOptions<unknown>
): UseStoreReturn<TState, TArg> {
  const { mode = 'sync', enabled = true, defaultValue } = options;
  const equalityFn = options.equalityFn ?? (typeof pathOrSelector === 'function' ? shallowEqual : Object.is);

  const getSnapshot = useMemo(
    () => makeSingleSnapshot(store, pathOrSelector, defaultValue),
    [store, pathOrSelector, defaultValue]
  );

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

  const getSnap = () => {
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
  };

  const selected = useSyncExternalStore(subscribe, getSnap, getSnap);

  const setState = useCallback(
    (value: unknown) => {
      if (typeof pathOrSelector === 'string') {
        store.setState(pathOrSelector as PathOf<TState>, value as PathValue<TState, PathOf<TState>>);
      } else if (isPathResolver<TState>(pathOrSelector)) {
        store.setState(pathOrSelector(store.getState()), value as PathValue<TState, PathOf<TState>>);
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
  const { mode = 'sync', enabled = true } = options;
  const defaultValue = options.defaultValue as unknown;
  const equalityFn =
    (options.equalityFn as ((a: unknown[], b: unknown[]) => boolean) | undefined) ?? defaultMultiEqualityFn;
  const pathsKey = paths.join('|');

  const lastRef = useRef<unknown[] | null>(null);

  const getSnapshot = useMemo(
    () => makeMultiSnapshot(store, paths, lastRef, { equalityFn, defaultValue }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, pathsKey, equalityFn, defaultValue]
  );

  const subscribe = useMultiSubscribe(store, paths, pathsKey, enabled, mode, true);
  const selected = useMultiExternalStore(subscribe, getSnapshot, enabled, lastRef);
  const setters = useMultiSetters(store, paths, pathsKey);

  return [selected, ...setters] as unknown as MultiPathReturn<TState, Paths>;
}

function useStore<TState extends object>(
  arg?: undefined,
  options?: UseStoreOptions<TState>
): [TState, StoreApi<TState>['setState']];

function useStore<TState extends object, P extends PathOf<TState>>(
  path: P,
  options?: UseStoreOptions<PathValue<TState, P>> & { defaultValue?: never }
): [
  PathValue<TState, P>,
  (value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)) => void
];

function useStore<TState extends object, P extends PathOf<TState>, D>(
  path: P,
  options: UseStoreOptions<PathValue<TState, P>> & { defaultValue: D }
): [
  NonNullable<PathValue<TState, P>> | D,
  (value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)) => void
];

function useStore<TState extends object, P extends PathOf<TState>>(
  pathResolver: PathResolverFn<TState, P>,
  options?: UseStoreOptions<PathValue<TState, P>>
): [PathValue<TState, P>, PathSetter<TState, P>];

function useStore<TState extends object, TSelected>(
  selector: (state: TState) => TSelected,
  options?: UseStoreOptions<TSelected>
): [TSelected, StoreApi<TState>['setState']];

function useStore<TState extends object, const Paths extends ReadonlyArray<PathOf<TState>>>(
  paths: Paths,
  options?: Omit<UseStoreMultiOptions<TState, Paths>, 'defaultValue'>
): MultiPathReturn<TState, Paths, __NoDefault>;

function useStore<
  TState extends object,
  const Paths extends ReadonlyArray<PathOf<TState>>,
  const TDefaultValue extends readonly (PathValue<TState, Paths[number]> | undefined)[]
>(
  paths: Paths,
  options: UseStoreMultiOptions<TState, Paths, TDefaultValue> & { defaultValue: TDefaultValue }
): MultiPathReturn<TState, Paths, TDefaultValue>;

function useStore<
  TState extends object,
  const Paths extends ReadonlyArray<PathOf<TState>>,
  const TDefaultValue extends PathValue<TState, Paths[number]>
>(
  paths: Paths,
  options: UseStoreMultiOptions<TState, Paths, TDefaultValue> & { defaultValue: TDefaultValue }
): MultiPathReturn<TState, Paths, TDefaultValue>;

function useStore<TState extends object>(
  arg?: PathOf<TState> | ReadonlyArray<PathOf<TState>> | ((state: TState) => unknown),
  options: UseStoreOptions<any, any> = {}
): unknown {
  const store = useResolvedStore(options.store as StoreApi<TState> | undefined, 'useStore');

  if (Array.isArray(arg)) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useMultiStore(store, arg as ReadonlyArray<PathOf<TState>>, options);
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useSingleStore(store, arg as PathOf<TState> | ((state: TState) => unknown) | undefined, options);
}

export type { PathSetters, PathValues };

export default useStore;
