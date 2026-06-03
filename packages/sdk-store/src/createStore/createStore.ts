/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */

import useStoreBase from '../hooks/useStore';
import useStoreGetterBase from '../hooks/useStoreGetter';
import useStoreSetterBase from '../hooks/useStoreSetter';
import useStoreSyncBase from '../hooks/useStoreSync';
import { createGetPath } from './helpers/createGetPath';
import { createGetState } from './helpers/createGetState';
import { createSetState } from './helpers/createSetState';
import { forwardParentChanges } from './helpers/forwardParentChanges';

import type {
  GetState,
  GetterTuple,
  GetValueFn,
  GetValueFromBaseFn,
  GetValueFromBaseWithDefaultFn,
  Listener,
  MultiPathReturn,
  Path,
  PathOf,
  PathOrFn,
  PathOrFnSetters,
  PathOrFnValue,
  PathOrFnValues,
  PathSetters,
  PathSetter,
  PathValue,
  PathValues,
  SetFromBaseFn,
  SetState,
  SetStateFn,
  StoreApi,
  StoreApiInternal,
  StoreLogger,
  UseStoreGetterOptions,
  UseStoreMultiOptions,
  UseStoreOptions,
  UseStoreSetterOptions,
  UseStoreSyncMultiOptions,
  UseStoreSyncOptions
} from '../types';

function createStore<TState extends object>(
  initializer: Partial<TState> | ((set: SetState<TState>, get: GetState<TState>) => Partial<TState>),
  storeOptions?: { logger?: StoreLogger<TState>; parent?: StoreApi<TState> }
): StoreApi<TState> {
  let state = {} as TState;
  const listeners = new Set<Listener>();
  const pathListeners = new Map<Path, Set<Listener>>();
  const historyListeners = new Set<Listener>();
  const parent = storeOptions?.parent;
  const getOwnState = () => state;

  const { getState, getMergeCount } = createGetState<TState>(getOwnState, parent);
  const getPath = createGetPath<TState>(getOwnState, parent, getState);
  const setState = createSetState<TState>({
    getOwnState,
    setOwnState: next => {
      state = next;
    },
    parent,
    listeners,
    pathListeners,
    historyListeners,
    logger: storeOptions?.logger
  });

  const subscribe = (listener: Listener): (() => void) => {
    listeners.add(listener);

    return () => listeners.delete(listener);
  };

  const subscribePath = <P extends PathOf<TState>>(path: P, listener: Listener): (() => void) => {
    let set = pathListeners.get(path);
    if (!set) {
      set = new Set();
      pathListeners.set(path, set);
    }

    set.add(listener);

    return () => set.delete(listener);
  };

  const subscribeHistory = (listener: Listener): (() => void) => {
    historyListeners.add(listener);

    return () => historyListeners.delete(listener);
  };

  state = (typeof initializer === 'function' ? initializer(setState, getState) : initializer) as TState;

  // Handle to stop listening to the parent, kept so `destroy()` can detach this scope (otherwise the parent
  // holds a reference to this scope's forwarder forever — a leak for short-lived scopes like list items).
  // Undefined for root stores, which have no parent to listen to.
  const parentUnsub = parent ? forwardParentChanges(parent, listeners, pathListeners, historyListeners) : undefined;

  const destroy = () => {
    parentUnsub?.();
    listeners.clear();
    pathListeners.clear();
    historyListeners.clear();
  };

  const api: StoreApi<TState> = { getState, getPath, setState, subscribe, subscribePath, subscribeHistory, destroy };

  if (import.meta.env.MODE === 'test') {
    (api as StoreApiInternal<TState>).listeners = listeners;
    (api as StoreApiInternal<TState>).pathListeners = pathListeners;
    (api as StoreApiInternal<TState>).historyListeners = historyListeners;
    (api as StoreApiInternal<TState>).getMergeCount = getMergeCount;
  }

  return api;
}

export const createStoreHook = <TState extends object>() => {
  function useStore(options?: UseStoreOptions<TState, TState>): [TState, StoreApi<TState>['setState']];

  function useStore<P extends PathOf<TState>>(
    path: P,
    options: Omit<UseStoreOptions<PathValue<TState, P>, TState>, 'defaultValue'> & {
      defaultValue: undefined;
      transformer?: never;
    }
  ): [
    PathValue<TState, P> | undefined,
    (value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)) => void
  ];

  function useStore<P extends PathOf<TState>>(
    path: P,
    options?: UseStoreOptions<PathValue<TState, P>, TState> & { defaultValue?: never; transformer?: never }
  ): [
    PathValue<TState, P>,
    (value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)) => void
  ];

  function useStore<P extends PathOf<TState>, D>(
    path: P,
    options: UseStoreOptions<PathValue<TState, P>, TState> & { defaultValue: D; transformer?: never }
  ): [
    NonNullable<PathValue<TState, P>> | D,
    (value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)) => void
  ];

  function useStore<P extends PathOf<TState>, TResult>(
    path: P,
    options: UseStoreOptions<PathValue<TState, P>, TState> & { transformer: (value: PathValue<TState, P>) => TResult }
  ): [TResult, (value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)) => void];

  function useStore<P extends PathOf<TState>>(
    pathFn: (state: TState) => P,
    options: Omit<UseStoreOptions<PathValue<TState, P>, TState>, 'defaultValue'> & {
      defaultValue: undefined;
      transformer?: never;
    }
  ): [PathValue<TState, P> | undefined, PathSetter<TState, P>];

  function useStore<P extends PathOf<TState>>(
    pathFn: (state: TState) => P,
    options?: UseStoreOptions<PathValue<TState, P>, TState> & { defaultValue?: never; transformer?: never }
  ): [PathValue<TState, P>, PathSetter<TState, P>];

  function useStore<P extends PathOf<TState>, D>(
    pathFn: (state: TState) => P,
    options: UseStoreOptions<PathValue<TState, P>, TState> & { defaultValue: D; transformer?: never }
  ): [NonNullable<PathValue<TState, P>> | D, PathSetter<TState, P>];

  function useStore<P extends PathOf<TState>, TResult>(
    pathFn: (state: TState) => P,
    options: UseStoreOptions<PathValue<TState, P>, TState> & { transformer: (value: PathValue<TState, P>) => TResult }
  ): [TResult, PathSetter<TState, P>];

  function useStore<const Paths extends ReadonlyArray<PathOf<TState>>>(
    paths: Paths,
    options?: Omit<UseStoreMultiOptions<TState, Paths>, 'defaultValue' | 'transformer'>
  ): MultiPathReturn<TState, Paths>;

  function useStore<const Paths extends ReadonlyArray<PathOf<TState>>>(
    paths: Paths,
    options: UseStoreMultiOptions<TState, Paths> & { defaultValue: undefined; transformer?: never }
  ): MultiPathReturn<TState, Paths, undefined>;

  function useStore<
    const Paths extends ReadonlyArray<PathOf<TState>>,
    const TDefaultValue extends readonly (PathValue<TState, Paths[number]> | undefined)[]
  >(
    paths: Paths,
    options: UseStoreMultiOptions<TState, Paths, TDefaultValue> & { defaultValue: TDefaultValue; transformer?: never }
  ): MultiPathReturn<TState, Paths, TDefaultValue>;

  function useStore<
    const Paths extends ReadonlyArray<PathOf<TState>>,
    TDefaultValue extends PathValue<TState, Paths[number]>
  >(
    paths: Paths,
    options: UseStoreMultiOptions<TState, Paths, TDefaultValue> & { defaultValue: TDefaultValue; transformer?: never }
  ): MultiPathReturn<TState, Paths, TDefaultValue>;

  function useStore<const Paths extends ReadonlyArray<PathOf<TState>>, TResult>(
    paths: Paths,
    options: UseStoreMultiOptions<TState, Paths> & { transformer: (values: PathValues<TState, Paths>) => TResult }
  ): [TResult, ...PathSetters<TState, Paths>];

  function useStore<const Entries extends ReadonlyArray<PathOrFn<TState>>>(
    paths: Entries,
    options?: Omit<UseStoreMultiOptions<TState, any>, 'defaultValue' | 'transformer'> & { transformer?: never }
  ): [PathOrFnValues<TState, Entries>, ...PathOrFnSetters<TState, Entries>];

  function useStore<const Entries extends ReadonlyArray<PathOrFn<TState>>>(
    paths: Entries,
    options: Omit<UseStoreMultiOptions<TState, any>, 'defaultValue' | 'transformer'> & {
      defaultValue: undefined;
      transformer?: never;
    }
  ): [{ [I in keyof Entries]: PathOrFnValue<TState, Entries[I]> | undefined }, ...PathOrFnSetters<TState, Entries>];

  function useStore<
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

  function useStore<const Entries extends ReadonlyArray<PathOrFn<TState>>, TResult>(
    paths: Entries,
    options: Omit<UseStoreMultiOptions<TState, any>, 'defaultValue' | 'transformer'> & {
      transformer: (values: PathOrFnValues<TState, Entries>) => TResult;
    }
  ): [TResult, ...PathOrFnSetters<TState, Entries>];

  function useStore(arg?: any, options?: any): unknown {
    return useStoreBase(arg, options);
  }

  function useStoreSync(
    path: undefined,
    value: TState | Partial<TState>,
    options?: UseStoreSyncOptions<TState, TState>
  ): void;

  function useStoreSync<P extends PathOf<TState>>(
    path: P | ((state: TState) => P),
    value: PathValue<TState, P>,
    options?: UseStoreSyncOptions<PathValue<TState, P>, TState>
  ): void;

  function useStoreSync<const Paths extends ReadonlyArray<PathOf<TState>>>(
    paths: Paths,
    values: PathValues<TState, Paths>,
    options?: UseStoreSyncMultiOptions<TState>
  ): void;

  function useStoreSync(
    paths: ReadonlyArray<PathOrFn<TState>>,
    values: readonly unknown[],
    options?: UseStoreSyncMultiOptions<TState>
  ): void;

  function useStoreSync(pathOrPaths: any, value: any, options?: any): void {
    useStoreSyncBase<TState, PathOf<TState>>(pathOrPaths, value, options);
  }

  function useStoreGetter(options?: UseStoreGetterOptions<TState>): GetValueFn<TState>;

  function useStoreGetter<P extends PathOf<TState>>(
    basePath: P,
    options?: UseStoreGetterOptions<TState>
  ): GetValueFromBaseFn<PathValue<TState, P>>;

  function useStoreGetter<P extends PathOf<TState>, D>(
    basePath: P,
    options: UseStoreGetterOptions<TState, D> & { defaultValue: D }
  ): GetValueFromBaseWithDefaultFn<PathValue<TState, P>, D>;

  function useStoreGetter<const Entries extends ReadonlyArray<PathOf<TState> | ((state: TState) => unknown)>>(
    entries: Entries,
    options?: UseStoreGetterOptions<TState>
  ): GetterTuple<TState, Entries>;

  function useStoreGetter(arg?: any, options?: any): unknown {
    return (useStoreGetterBase as (a?: any, b?: any) => unknown)(arg, options);
  }

  function useStoreSetter(options?: UseStoreSetterOptions<TState>): SetStateFn<TState>;

  function useStoreSetter<P extends PathOf<TState>>(
    basePath: P,
    options?: UseStoreSetterOptions<TState>
  ): SetFromBaseFn<PathValue<TState, P>>;

  function useStoreSetter(arg?: any, options?: any): unknown {
    return (useStoreSetterBase as (a?: any, b?: any) => unknown)(arg, options);
  }

  return { useStore, useStoreSync, useStoreGetter, useStoreSetter };
};

export default createStore;
