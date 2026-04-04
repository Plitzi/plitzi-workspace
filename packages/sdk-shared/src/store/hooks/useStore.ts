import { use, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';

import getByPath from '../helpers/getByPath';
import { StoreContext } from '../StoreProvider';

import type { PathOf, PathValue, StoreApi } from '../../types/StoreTypes';

// Return type based on the argument:
//   path string  → [PathValue, setByPath]
//   selector fn  → [TSelected, setState]
//   undefined    → [TState, setState]
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
  TArg extends PathOf<TState> | ((state: TState) => TState | PathValue<TState, TArg>) | undefined = undefined
>(pathOrSelector?: TArg, equalityFn: (a: unknown, b: unknown) => boolean = Object.is): UseStoreReturn<TState, TArg> {
  const store = use(StoreContext) as StoreApi<TState> | undefined;
  if (!store) {
    throw new Error('useStore must be used inside a StoreProvider');
  }

  // Stable snapshot function — recreated only when pathOrSelector or store changes,
  // not on every render. This is critical for useSyncExternalStore performance.
  const getSnapshot = useMemo(
    () => (): unknown => {
      if (typeof pathOrSelector === 'function') {
        return pathOrSelector(store.getState());
      }

      if (typeof pathOrSelector === 'string') {
        return getByPath(store.getState(), pathOrSelector as PathOf<TState>);
      }

      return store.getState();
    },
    [store, pathOrSelector]
  );

  // Tracks the last returned value to bail out of re-renders when equalityFn returns true.
  // Initialized lazily to avoid calling getSnapshot before the store is ready.
  const lastRef = useRef<unknown>(undefined);
  if (lastRef.current === undefined) {
    lastRef.current = getSnapshot();
  }

  // Stable subscribe function — same rationale as getSnapshot.
  const subscribe = useMemo(
    () => (cb: () => void) => {
      if (typeof pathOrSelector === 'string') {
        return store.subscribePath(pathOrSelector as PathOf<TState>, cb);
      }

      return store.subscribe(cb);
    },
    [store, pathOrSelector]
  );

  const selected = useSyncExternalStore(
    subscribe,
    // Returns the cached value if equalityFn says nothing changed,
    // avoiding a re-render even when the store notifies.
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
