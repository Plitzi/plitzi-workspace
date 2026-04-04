/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */

import getByPath from './helpers/getByPath';
import isPathAffected from './helpers/isPathAffected';
import setByPath from './helpers/setByPath';
import useStoreBase from './hooks/useStore';
import useStoreSyncBase from './hooks/useStoreSync';

import type {
  GetState,
  Listener,
  Path,
  PathOf,
  PathValue,
  SetState,
  StoreApi,
  StoreApiInternal,
  SyncMode
} from '../types';

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

//   const useMyStore = createStoreHook<MyState>()
//   useMyStore()                       → [MyState, setState]
//   useMyStore('user.name')            → [string, setName]
//   useMyStore(s => s.count)           → [number, setState]
export const createStoreHook = <TState extends object>() => {
  // useStore

  function useStore(): [TState, StoreApi<TState>['setState']];

  function useStore<P extends PathOf<TState>>(
    path: P,
    equalityFn?: (a: PathValue<TState, P>, b: PathValue<TState, P>) => boolean
  ): [
    PathValue<TState, P>,
    (value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)) => void
  ];

  function useStore<TSelected>(
    selector: (state: TState) => TSelected,
    equalityFn?: (a: TSelected, b: TSelected) => boolean
  ): [TSelected, StoreApi<TState>['setState']];

  function useStore(
    pathOrSelector?: PathOf<TState> | ((state: TState) => any),
    equalityFn?: (a: any, b: any) => boolean
  ): any {
    return useStoreBase<TState, any>(pathOrSelector, equalityFn);
  }

  // useStoreSync

  function useStoreSync<P extends PathOf<TState>>(
    path: P,
    value: PathValue<TState, P>,
    mode?: SyncMode,
    equalityFn?: (a: PathValue<TState, P>, b: PathValue<TState, P>) => boolean
  ) {
    return useStoreSyncBase<TState, P>(path, value, mode, equalityFn);
  }

  return { useStore, useStoreSync };
};

export default createStore;
