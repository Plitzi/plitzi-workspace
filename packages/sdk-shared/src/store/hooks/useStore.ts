import { use, useCallback, useRef, useSyncExternalStore } from 'react';

import getByPath from '../helpers/getByPath';
import { StoreContext } from '../StoreProvider';

import type { PathOf, PathValue, StoreApi } from '../../types/StoreTypes';

export type UseStoreReturn<TState extends object, TArg> =
  TArg extends PathOf<TState>
    ? [
        PathValue<TState, TArg>,
        (value: PathValue<TState, TArg> | ((prev: PathValue<TState, TArg>) => PathValue<TState, TArg>)) => void
      ]
    : TArg extends (state: TState) => infer TSelected
      ? [TSelected, StoreApi<TState>['setState']]
      : [TState, StoreApi<TState>['setState']];

function useStore<
  TState extends object,
  TArg extends PathOf<TState> | ((state: TState) => unknown) | undefined = undefined
>(pathOrSelector?: TArg, equalityFn: (a: unknown, b: unknown) => boolean = Object.is): UseStoreReturn<TState, TArg> {
  const store = use(StoreContext) as StoreApi<TState> | undefined;
  if (!store) {
    throw new Error('useStore must be used inside a StoreProvider');
  }

  const getSnapshot = () => {
    if (!pathOrSelector) {
      return store.getState();
    }

    if (typeof pathOrSelector === 'function') {
      return pathOrSelector(store.getState());
    }

    return getByPath(store.getState(), pathOrSelector as PathOf<TState>);
  };

  const lastRef = useRef(getSnapshot());

  const selected = useSyncExternalStore(
    cb => {
      if (!pathOrSelector || typeof pathOrSelector === 'function') {
        return store.subscribe(cb);
      }

      return store.subscribePath(pathOrSelector as PathOf<TState>, cb);
    },
    () => {
      const next = getSnapshot();
      if (equalityFn(lastRef.current, next)) {
        return lastRef.current;
      }

      lastRef.current = next;

      return next;
    }
  );

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

export default useStore;
