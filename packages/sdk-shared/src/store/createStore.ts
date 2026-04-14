/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */

import getByPath from './helpers/getByPath';
import isPathAffected from './helpers/isPathAffected';
import setByPath from './helpers/setByPath';
import useStoreBase from './hooks/useStore';
import useStoreGetterBase from './hooks/useStoreGetter';
import useStoreSetterBase from './hooks/useStoreSetter';
import useStoreSyncBase from './hooks/useStoreSync';

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
  PathSetters,
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
  storeOptions?: { logger?: StoreLogger<TState> }
): StoreApi<TState> {
  let state: TState;
  const listeners = new Set<Listener>();
  const pathListeners = new Map<Path, Set<Listener>>();

  const getState: GetState<TState> = () => state;

  const setState: SetState<TState> = <P extends PathOf<TState>>(
    path: P | undefined,
    value:
      | PathValue<TState, P>
      | ((prev: PathValue<TState, P>) => PathValue<TState, P>)
      | TState
      | ((prev: TState) => TState),
    canPropagate: boolean = true
  ) => {
    const prevState = state;

    const resolvedValue = path
      ? typeof value === 'function'
        ? (value as (prev: PathValue<TState, P>) => PathValue<TState, P>)(
            getByPath(prevState, path) as PathValue<TState, P>
          )
        : value
      : undefined;

    if (path && Object.is(getByPath(prevState, path), resolvedValue)) {
      return;
    }

    const nextState: TState = path
      ? setByPath(prevState, path, resolvedValue)
      : typeof value === 'function'
        ? (value as (prev: TState) => TState)(prevState)
        : { ...prevState, ...(value as TState) };

    if (Object.is(nextState, prevState)) {
      return;
    }

    state = nextState;
    storeOptions?.logger?.({ path, prev: prevState, next: state });
    if (!canPropagate) {
      return;
    }

    listeners.forEach(l => l());
    pathListeners.forEach((set, candidate) => {
      if (path && !isPathAffected(path, candidate)) {
        return;
      }

      const prev = getByPath(prevState, candidate as PathOf<TState>);
      const next = getByPath(state, candidate as PathOf<TState>);
      if (!Object.is(prev, next)) {
        set.forEach(l => l());
      }
    });
  };

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

  state = (typeof initializer === 'function' ? initializer(setState, getState) : initializer) as TState;

  const api: StoreApi<TState> = { getState, setState, subscribe, subscribePath };

  if (import.meta.env.MODE === 'test') {
    (api as StoreApiInternal<TState>).listeners = listeners;
    (api as StoreApiInternal<TState>).pathListeners = pathListeners;
  }

  return api;
}

export const createStoreHook = <TState extends object>() => {
  function useStore(options?: UseStoreOptions<TState, TState>): [TState, StoreApi<TState>['setState']];

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

  function useStore(
    pathFn: (state: TState) => PathOf<TState>,
    options?: UseStoreOptions<unknown, TState> & { transformer?: never }
  ): [unknown, (value: unknown) => void];

  function useStore<TResult>(
    pathFn: (state: TState) => PathOf<TState>,
    options: UseStoreOptions<unknown, TState> & { transformer: (value: unknown) => TResult }
  ): [TResult, (value: unknown) => void];

  function useStore<const Paths extends ReadonlyArray<PathOf<TState>>>(
    paths: Paths,
    options?: Omit<UseStoreMultiOptions<TState, Paths>, 'defaultValue' | 'transformer'>
  ): MultiPathReturn<TState, Paths>;

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

  function useStore(arg?: any, options?: any): unknown {
    return useStoreBase(arg, options);
  }

  function useStoreSync(
    path: undefined,
    value: TState | Partial<TState>,
    options?: UseStoreSyncOptions<TState, TState>
  ): void;

  function useStoreSync<P extends PathOf<TState>>(
    path: P,
    value: PathValue<TState, P>,
    options?: UseStoreSyncOptions<PathValue<TState, P>, TState>
  ): void;

  function useStoreSync<const Paths extends ReadonlyArray<PathOf<TState>>>(
    paths: Paths,
    values: PathValues<TState, Paths>,
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
