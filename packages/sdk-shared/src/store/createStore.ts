/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */

import getByPath from './helpers/getByPath';
import setByPath from './helpers/setByPath';
import useStoreBase from './hooks/useStore';

import type { GetState, Listener, Path, PathOf, PathValue, SetState, StoreApi, StoreApiInternal } from '../types';

const isTest = import.meta.env.MODE === 'test';

function createStore<TState extends object>(
  initializer: (set: SetState<TState>, get: GetState<TState>) => TState
): StoreApi<TState> {
  let state: TState;
  const listeners = new Set<Listener>();
  const pathListeners = new Map<Path, Set<Listener>>();

  const getState: GetState<TState> = () => state;

  const setState: SetState<TState> = <P extends PathOf<TState>>(
    path: P | '' | undefined,
    value?:
      | PathValue<TState, P>
      | ((prev: PathValue<TState, P>) => PathValue<TState, P>)
      | TState
      | ((prev: TState) => TState)
  ) => {
    const prevState = state;
    let nextState: TState;

    if (path) {
      const prevValue = getByPath(prevState, path);
      const newValue =
        typeof value === 'function' ? (value as (prev: typeof prevValue) => typeof prevValue)(prevValue) : value;
      nextState = setByPath(prevState, path, newValue);
    } else {
      nextState =
        typeof value === 'function' ? (value as (prev: TState) => TState)(prevState) : { ...prevState, ...value };
    }

    if (Object.is(nextState, prevState)) {
      return;
    }

    state = nextState;
    listeners.forEach(l => l());
    pathListeners.forEach((set, path) => {
      const prevValue = getByPath(prevState, path as PathOf<TState>);
      const nextValue = getByPath(state, path as PathOf<TState>);
      if (!Object.is(prevValue, nextValue)) {
        set.forEach(l => l());
      }
    });
  };

  const subscribe = (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const subscribePath = <P extends PathOf<TState>>(path: P, listener: Listener) => {
    if (!pathListeners.has(path)) {
      pathListeners.set(path, new Set());
    }

    pathListeners.get(path)?.add(listener);

    return () => {
      pathListeners.get(path)?.delete(listener);
    };
  };

  state = initializer(setState, getState);

  const api: StoreApi<TState> = { getState, setState, subscribe, subscribePath };

  // Solo en tests exponemos los internals para poder verificar memoria y listeners
  if (isTest) {
    (api as StoreApiInternal<TState>).listeners = listeners;
    (api as StoreApiInternal<TState>).pathListeners = pathListeners;
  }

  return api;
}

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
