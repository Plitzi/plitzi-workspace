/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';

import {
  defaultMultiEqualityFn,
  makeMultiSnapshot,
  makeSingleSnapshot,
  useMultiExternalStore,
  useMultiSetters,
  useMultiSubscribe,
  useResolvedStore
} from './shared';
import shallowEqual from '../../helpers/shallowEqual';

import type {
  __NoDefault,
  MultiPathReturn,
  PathOf,
  PathOrFn,
  PathOrFnSetters,
  PathOrFnValue,
  PathOrFnValues,
  PathSetter,
  PathSetters,
  PathValue,
  PathValues,
  StoreApi,
  UseStoreMultiOptions,
  UseStoreOptions,
  UseStoreReturn
} from '../../types';

export { defaultMultiEqualityFn } from './shared';
export type { MultiPathReturn, UseStoreOptions, UseStoreMultiOptions, UseStoreReturn };

const EMPTY_PATHS: ReadonlyArray<never> = [];

function useSingleStore<TState extends object>(
  store: StoreApi<TState>,
  pathOrFn: PathOf<TState> | ((state: TState) => PathOf<TState>) | undefined,
  options: UseStoreOptions<any>
): [unknown, (value: unknown) => void] {
  const mode = options.mode ?? 'sync';
  const enabled = options.enabled ?? true;
  const defaultValue = options.defaultValue as unknown;
  const isFullState = pathOrFn === undefined;
  const equalityFn =
    (options.equalityFn as ((a: unknown, b: unknown) => boolean) | undefined) ??
    (isFullState ? shallowEqual : Object.is);
  const transformer = options.transformer as ((value: unknown) => unknown) | undefined;
  const transformerRef = useRef<typeof transformer>(transformer);
  transformerRef.current = transformer;

  const getSnapshot = useMemo(() => makeSingleSnapshot(store, pathOrFn, defaultValue), [store, pathOrFn, defaultValue]);

  const lastRef = useRef<unknown>(getSnapshot());

  const subscribe = useMemo(
    () =>
      (cb: () => void): (() => void) => {
        if (!enabled || mode === 'mount') {
          return () => {};
        }

        if (typeof pathOrFn === 'string') {
          return store.subscribePath(pathOrFn, cb);
        }

        return store.subscribe(cb);
      },
    [enabled, mode, pathOrFn, store]
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

  const raw = useSyncExternalStore(subscribe, getSnap, getSnap);

  const result = useMemo(() => (transformerRef.current ? transformerRef.current(raw) : raw), [raw]);

  const setState = useCallback(
    (value: unknown) => {
      if (isFullState) {
        store.setState(undefined, value as TState);
      } else if (typeof pathOrFn === 'function') {
        store.setState(pathOrFn(store.getState()), value as PathValue<TState, PathOf<TState>>);
      } else {
        store.setState(pathOrFn, value as PathValue<TState, PathOf<TState>>);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, pathOrFn]
  );

  return [result, setState];
}

function useMultiStore<TState extends object>(
  store: StoreApi<TState>,
  paths: ReadonlyArray<PathOrFn<TState>>,
  options: UseStoreMultiOptions<TState, any>
): unknown {
  const mode = options.mode ?? 'sync';
  const enabled = options.enabled ?? true;
  const defaultValue = options.defaultValue as unknown;
  const equalityFn =
    (options.equalityFn as ((a: unknown[], b: unknown[]) => boolean) | undefined) ?? defaultMultiEqualityFn;
  const transformer = options.transformer as ((values: unknown[]) => unknown) | undefined;
  const transformerRef = useRef<typeof transformer>(transformer);
  transformerRef.current = transformer;

  const pathsRef = useRef<ReadonlyArray<PathOrFn<TState>>>(paths);
  pathsRef.current = paths;

  const pathsKey = paths.map((p, i) => (typeof p === 'function' ? `fn_${i}` : p)).join('|');

  const lastRef = useRef<unknown[] | null>(null);

  const getSnapshot = useMemo(
    () => makeMultiSnapshot(store, pathsRef, lastRef, { equalityFn, defaultValue }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, pathsKey, equalityFn, defaultValue]
  );

  const subscribe = useMultiSubscribe(store, pathsRef, pathsKey, enabled, mode);
  const rawSelected = useMultiExternalStore(subscribe, getSnapshot, enabled, lastRef);

  const result = useMemo(
    () => (transformerRef.current ? transformerRef.current(rawSelected) : rawSelected),
    [rawSelected]
  );

  const setters = useMultiSetters(store, pathsRef, pathsKey);

  return [result, ...setters];
}

function useStore<TState extends object>(
  arg?: undefined,
  options?: UseStoreOptions<TState>
): [TState, StoreApi<TState>['setState']];

function useStore<TState extends object, P extends PathOf<TState>>(
  path: P,
  options: Omit<UseStoreOptions<PathValue<TState, P>>, 'defaultValue'> & {
    defaultValue: undefined;
    transformer?: never;
  }
): [PathValue<TState, P> | undefined, PathSetter<TState, P>];

function useStore<TState extends object, P extends PathOf<TState>>(
  path: P,
  options?: UseStoreOptions<PathValue<TState, P>> & { defaultValue?: never; transformer?: never }
): [PathValue<TState, P>, PathSetter<TState, P>];

function useStore<TState extends object, P extends PathOf<TState>, D>(
  path: P,
  options: UseStoreOptions<PathValue<TState, P>> & { defaultValue: D; transformer?: never }
): [NonNullable<PathValue<TState, P>> | D, PathSetter<TState, P>];

function useStore<TState extends object, P extends PathOf<TState>, TResult>(
  path: P,
  options: UseStoreOptions<PathValue<TState, P>> & { transformer: (value: PathValue<TState, P>) => TResult }
): [TResult, PathSetter<TState, P>];

function useStore<TState extends object, P extends PathOf<TState>>(
  pathFn: (state: TState) => P,
  options: Omit<UseStoreOptions<PathValue<TState, P>, TState>, 'defaultValue'> & {
    defaultValue: undefined;
    transformer?: never;
  }
): [PathValue<TState, P> | undefined, PathSetter<TState, P>];

function useStore<TState extends object, P extends PathOf<TState>>(
  pathFn: (state: TState) => P,
  options?: UseStoreOptions<PathValue<TState, P>, TState> & { defaultValue?: never; transformer?: never }
): [PathValue<TState, P>, PathSetter<TState, P>];

function useStore<TState extends object, P extends PathOf<TState>, D>(
  pathFn: (state: TState) => P,
  options: UseStoreOptions<PathValue<TState, P>, TState> & { defaultValue: D; transformer?: never }
): [NonNullable<PathValue<TState, P>> | D, PathSetter<TState, P>];

function useStore<TState extends object, P extends PathOf<TState>, TResult>(
  pathFn: (state: TState) => P,
  options: UseStoreOptions<PathValue<TState, P>, TState> & { transformer: (value: PathValue<TState, P>) => TResult }
): [TResult, PathSetter<TState, P>];

function useStore<TState extends object, const Paths extends ReadonlyArray<PathOf<TState>>>(
  paths: Paths,
  options?: Omit<UseStoreMultiOptions<TState, Paths>, 'defaultValue' | 'transformer'>
): MultiPathReturn<TState, Paths, __NoDefault>;

function useStore<TState extends object, const Paths extends ReadonlyArray<PathOf<TState>>>(
  paths: Paths,
  options: UseStoreMultiOptions<TState, Paths> & { defaultValue: undefined; transformer?: never }
): MultiPathReturn<TState, Paths, undefined>;

function useStore<
  TState extends object,
  const Paths extends ReadonlyArray<PathOf<TState>>,
  const TDefaultValue extends readonly (PathValue<TState, Paths[number]> | undefined)[]
>(
  paths: Paths,
  options: UseStoreMultiOptions<TState, Paths, TDefaultValue> & { defaultValue: TDefaultValue; transformer?: never }
): MultiPathReturn<TState, Paths, TDefaultValue>;

function useStore<
  TState extends object,
  const Paths extends ReadonlyArray<PathOf<TState>>,
  TDefaultValue extends PathValue<TState, Paths[number]>
>(
  paths: Paths,
  options: UseStoreMultiOptions<TState, Paths, TDefaultValue> & { defaultValue: TDefaultValue; transformer?: never }
): MultiPathReturn<TState, Paths, TDefaultValue>;

function useStore<TState extends object, const Paths extends ReadonlyArray<PathOf<TState>>, TResult>(
  paths: Paths,
  options: UseStoreMultiOptions<TState, Paths> & { transformer: (values: PathValues<TState, Paths>) => TResult }
): [TResult, ...PathSetters<TState, Paths>];

function useStore<TState extends object, const Entries extends ReadonlyArray<PathOrFn<TState>>>(
  paths: Entries,
  options?: Omit<UseStoreMultiOptions<TState, any>, 'defaultValue' | 'transformer'> & { transformer?: never }
): [PathOrFnValues<TState, Entries>, ...PathOrFnSetters<TState, Entries>];

function useStore<TState extends object, const Entries extends ReadonlyArray<PathOrFn<TState>>>(
  paths: Entries,
  options: Omit<UseStoreMultiOptions<TState, any>, 'defaultValue' | 'transformer'> & {
    defaultValue: undefined;
    transformer?: never;
  }
): [{ [I in keyof Entries]: PathOrFnValue<TState, Entries[I]> | undefined }, ...PathOrFnSetters<TState, Entries>];

function useStore<
  TState extends object,
  const Entries extends ReadonlyArray<PathOrFn<TState>>,
  const TDefaultValue extends readonly unknown[]
>(
  paths: Entries,
  options: Omit<UseStoreMultiOptions<TState, any>, 'defaultValue' | 'transformer'> & {
    defaultValue: TDefaultValue;
    transformer?: never;
  }
): [
  {
    [I in keyof Entries]: I extends keyof TDefaultValue
      ? TDefaultValue[I] extends undefined
        ? PathOrFnValue<TState, Entries[I]> | undefined
        : NonNullable<PathOrFnValue<TState, Entries[I]>> | TDefaultValue[I]
      : PathOrFnValue<TState, Entries[I]>;
  },
  ...PathOrFnSetters<TState, Entries>
];

function useStore<TState extends object, const Entries extends ReadonlyArray<PathOrFn<TState>>, TResult>(
  paths: Entries,
  options: Omit<UseStoreMultiOptions<TState, any>, 'defaultValue' | 'transformer'> & {
    transformer: (values: PathOrFnValues<TState, Entries>) => TResult;
  }
): [TResult, ...PathOrFnSetters<TState, Entries>];

function useStore<TState extends object>(
  arg?: PathOf<TState> | ReadonlyArray<PathOrFn<TState>> | ((state: TState) => PathOf<TState>),
  options: UseStoreOptions<any, any> = {}
): unknown {
  const store = useResolvedStore(options.store, 'useStore', options.storeId);
  const isMulti = Array.isArray(arg);

  // Both branches always run to keep the hook order stable when a call site
  // switches between a single path and an array of paths. The inactive branch is
  // disabled so it never subscribes nor runs a transformer over the wrong shape.
  const singleResult = useSingleStore(
    store,
    isMulti ? undefined : (arg as PathOf<TState> | ((state: TState) => PathOf<TState>) | undefined),
    isMulti ? { ...options, enabled: false, transformer: undefined } : options
  );

  const multiResult = useMultiStore(
    store,
    isMulti ? (arg as ReadonlyArray<PathOrFn<TState>>) : EMPTY_PATHS,
    isMulti ? options : { ...options, enabled: false, transformer: undefined }
  );

  return isMulti ? multiResult : singleResult;
}

export type { PathSetters, PathValues };

export default useStore;
