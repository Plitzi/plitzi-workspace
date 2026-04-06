/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */

import getByPath from './helpers/getByPath';
import isPathAffected from './helpers/isPathAffected';
import setByPath from './helpers/setByPath';
import useStoreBase from './hooks/useStore';
import useStoreSyncBase from './hooks/useStoreSync';

import type { GetState, Listener, Path, PathOf, PathValue, SetState, StoreApi, StoreApiInternal } from '../types';
import type { MultiPathReturn, UseStoreOptions, UseStoreMultiOptions } from './hooks/useStore';
import type { UseStoreSyncOptions } from './hooks/useStoreSync';

function createStore<TState extends object>(
  initializer: Partial<TState> | ((set: SetState<TState>, get: GetState<TState>) => Partial<TState>)
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

    const nextState: TState = path
      ? setByPath(
          prevState,
          path,
          typeof value === 'function'
            ? (value as (prev: PathValue<TState, P>) => PathValue<TState, P>)(
                getByPath(prevState, path) as PathValue<TState, P>
              )
            : value
        )
      : typeof value === 'function'
        ? (value as (prev: TState) => TState)(prevState)
        : { ...prevState, ...(value as TState) };

    if (Object.is(nextState, prevState)) {
      return;
    }

    state = nextState;
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
  function useStore(options?: UseStoreOptions<TState>): [TState, StoreApi<TState>['setState']];

  function useStore<P extends PathOf<TState>>(
    path: P,
    options?: Omit<UseStoreOptions<PathValue<TState, P>>, 'defaultValue'>
  ): [
    PathValue<TState, P>,
    (value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)) => void
  ];

  function useStore<P extends PathOf<TState>, D>(
    path: P,
    options: UseStoreOptions<PathValue<TState, P>> & { defaultValue: D }
  ): [
    PathValue<TState, P> | D,
    (value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)) => void
  ];

  function useStore<TSelected>(
    selector: (state: TState) => TSelected,
    options?: UseStoreOptions<TSelected>
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

  function useStore(
    arg?: PathOf<TState> | ReadonlyArray<PathOf<TState>> | ((state: TState) => unknown) | UseStoreOptions<any>,
    options?: UseStoreOptions<any>
  ): unknown {
    return (useStoreBase as (a?: unknown, b?: unknown) => unknown)(arg, options);
  }

  function useStoreSync(
    path: undefined,
    value: TState | Partial<TState>,
    options?: UseStoreSyncOptions<TState>
  ): [TState, (value: TState | ((prev: TState) => TState)) => void];

  function useStoreSync<P extends PathOf<TState>>(
    path: P,
    value: PathValue<TState, P>,
    options?: UseStoreSyncOptions<PathValue<TState, P>>
  ): [
    PathValue<TState, P>,
    (value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)) => void
  ];

  function useStoreSync(path: PathOf<TState> | undefined, value: unknown, options?: UseStoreSyncOptions<any>): unknown {
    return useStoreSyncBase<TState, PathOf<TState>>(
      path as PathOf<TState>,
      value as PathValue<TState, PathOf<TState>>,
      options
    );
  }

  return { useStore, useStoreSync };
};

export default createStore;
