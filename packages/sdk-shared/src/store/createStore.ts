/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */

import getByPath from './helpers/getByPath';
import setByPath from './helpers/setByPath';
import useStoreBase from './hooks/useStore';

import type { GetState, Listener, Path, PathOf, PathValue, SetState, StoreApi, StoreApiInternal } from '../types';

function createStore<TState extends object>(
  initializer: (set: SetState<TState>, get: GetState<TState>) => TState
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

    pathListeners.forEach((set, p) => {
      if (!Object.is(getByPath(prevState, p as PathOf<TState>), getByPath(state, p as PathOf<TState>))) {
        set.forEach(l => l());
      }
    });
  };

  const subscribe = (listener: Listener): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const subscribePath = <P extends PathOf<TState>>(path: P, listener: Listener): (() => void) => {
    if (!pathListeners.has(path)) {
      pathListeners.set(path, new Set());
    }

    pathListeners.get(path)?.add(listener);

    return () => pathListeners.get(path)?.delete(listener);
  };

  state = initializer(setState, getState);

  const api: StoreApi<TState> = { getState, setState, subscribe, subscribePath };

  // En modo test exponemos los internals para verificar memoria y listeners
  if (import.meta.env.MODE === 'test') {
    (api as StoreApiInternal<TState>).listeners = listeners;
    (api as StoreApiInternal<TState>).pathListeners = pathListeners;
  }

  return api;
}

// Fija TState una sola vez vía currying; TArg se infiere del argumento en cada llamada:
//   const useMyStore = createStoreHook<MyState>()
//   useMyStore()                       → [MyState, setState]
//   useMyStore('user.name')            → [string, setName]
//   useMyStore(s => s.count)           → [number, setState]
export const createStoreHook = <TState extends object>() => {
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

  return useStore;
};

export default createStore;
