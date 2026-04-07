/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */

import getByPath from './helpers/getByPath';
import isPathAffected from './helpers/isPathAffected';
import setByPath from './helpers/setByPath';
import useStoreBase from './hooks/useStore';
import useStoreGetterBase from './hooks/useStoreGetter';
import useStoreSyncBase from './hooks/useStoreSync';

import type {
  GetState,
  Listener,
  Path,
  PathOf,
  PathValue,
  PathValues,
  SetState,
  StoreApi,
  StoreApiInternal,
  StoreLogger
} from '../types';
import type { MultiPathReturn, UseStoreOptions, UseStoreMultiOptions } from './hooks/useStore';
import type {
  GetValueFn,
  GetValueFromBaseFn,
  GetValueFromBaseWithDefaultFn,
  GetValueMultiFn,
  UseStoreGetterOptions
} from './hooks/useStoreGetter';
import type { UseStoreSyncMultiOptions, UseStoreSyncOptions } from './hooks/useStoreSync';

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
      | ((prev: TState) => TState)
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

  // Expose internals in test mode to verify memory and listener cleanup
  if (import.meta.env.MODE === 'test') {
    (api as StoreApiInternal<TState>).listeners = listeners;
    (api as StoreApiInternal<TState>).pathListeners = pathListeners;
  }

  return api;
}

//   const { useStore, useStoreSync } = createStoreHook<MyState>()
//
//   useStore()                                          → [MyState, setState]
//   useStore('user.name')                               → [string, setName]
//   useStore(`schema.flat.${id}` as PathOf<MyState>)   → [Element, setElement]  dynamic path
//   useStore(s => s.count)                              → [number, setState]  shallowEqual by default
//   useStore(['user.name', 'count'])                    → [[name, count], setName, setCount]
//   useStore('user.name', { enabled: false })           → unsubscribed, returns last value
//   useStoreSync(undefined, fullState)                  → [TState, setState]  syncs full state
//   useStoreSync('schema', schema)                      → [Schema, setSchema]  sync on every render
//   useStoreSync('schema', schema, { mode: 'mount' })   → [Schema, setSchema]  sync on mount only
//   useStoreSync('schema', schema, { enabled: false })  → disabled, no sync
export const createStoreHook = <TState extends object>() => {
  // The overloads below intentionally mirror useStore.ts / useStoreSync.ts.
  // TypeScript does not support instantiating a generic function type (e.g. typeof useStoreBase<TState>),
  // so they must be re-declared here to bind TState at factory level.

  function useStore(options?: UseStoreOptions<TState, TState>): [TState, StoreApi<TState>['setState']];

  function useStore<P extends PathOf<TState>>(
    path: P,
    options?: Omit<UseStoreOptions<PathValue<TState, P>, TState>, 'defaultValue'>
  ): [
    PathValue<TState, P>,
    (value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)) => void
  ];

  function useStore<P extends PathOf<TState>, D>(
    path: P,
    options: UseStoreOptions<PathValue<TState, P>, TState> & { defaultValue: D }
  ): [
    NonNullable<PathValue<TState, P>> | D,
    (value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)) => void
  ];

  function useStore<TSelected>(
    selector: (state: TState) => TSelected,
    options?: UseStoreOptions<TSelected, TState>
  ): [TSelected, StoreApi<TState>['setState']];

  function useStore<const Paths extends ReadonlyArray<PathOf<TState>>>(
    paths: Paths,
    options?: Omit<UseStoreMultiOptions<TState, Paths>, 'defaultValue'>
  ): MultiPathReturn<TState, Paths>;

  function useStore<
    const Paths extends ReadonlyArray<PathOf<TState>>,
    const TDefaultValue extends readonly (PathValue<TState, Paths[number]> | undefined)[]
  >(
    paths: Paths,
    options: UseStoreMultiOptions<TState, Paths, TDefaultValue> & { defaultValue: TDefaultValue }
  ): MultiPathReturn<TState, Paths, TDefaultValue>;

  function useStore<
    const Paths extends ReadonlyArray<PathOf<TState>>,
    const TDefaultValue extends PathValue<TState, Paths[number]>
  >(
    paths: Paths,
    options: UseStoreMultiOptions<TState, Paths, TDefaultValue> & { defaultValue: TDefaultValue }
  ): MultiPathReturn<TState, Paths, TDefaultValue>;

  function useStore(arg?: any, options?: any): unknown {
    return useStoreBase(arg, options);
  }

  function useStoreSync(
    path: undefined,
    value: TState | Partial<TState>,
    options?: UseStoreSyncOptions<TState, TState>
  ): [TState, (value: TState | ((prev: TState) => TState)) => void];

  function useStoreSync<P extends PathOf<TState>>(
    path: P,
    value: PathValue<TState, P>,
    options?: UseStoreSyncOptions<PathValue<TState, P>, TState>
  ): [
    PathValue<TState, P>,
    (value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)) => void
  ];

  function useStoreSync<const Paths extends ReadonlyArray<PathOf<TState>>>(
    paths: Paths,
    values: PathValues<TState, Paths>,
    options?: UseStoreSyncMultiOptions<TState>
  ): MultiPathReturn<TState, Paths>;

  function useStoreSync(pathOrPaths: any, value: any, options?: any): unknown {
    return useStoreSyncBase<TState, PathOf<TState>>(pathOrPaths, value, options);
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

  function useStoreGetter<const Paths extends ReadonlyArray<PathOf<TState>>>(
    paths: Paths,
    options?: UseStoreGetterOptions<TState>
  ): GetValueMultiFn<TState, Paths>;

  function useStoreGetter<
    const Paths extends ReadonlyArray<PathOf<TState>>,
    const TDefaultValue extends readonly (PathValue<TState, Paths[number]> | undefined)[]
  >(
    paths: Paths,
    options: UseStoreGetterOptions<TState, TDefaultValue> & { defaultValue: TDefaultValue }
  ): GetValueMultiFn<TState, Paths, TDefaultValue>;

  function useStoreGetter<
    const Paths extends ReadonlyArray<PathOf<TState>>,
    const TDefaultValue extends PathValue<TState, Paths[number]>
  >(
    paths: Paths,
    options: UseStoreGetterOptions<TState, TDefaultValue> & { defaultValue: TDefaultValue }
  ): GetValueMultiFn<TState, Paths, TDefaultValue>;

  function useStoreGetter(arg?: any, options?: any): unknown {
    return (useStoreGetterBase as (a?: any, b?: any) => unknown)(arg, options);
  }

  return { useStore, useStoreSync, useStoreGetter };
};

export default createStore;
