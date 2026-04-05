/* eslint-disable @typescript-eslint/no-explicit-any */

import { use, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';

import getByPath from '../helpers/getByPath';
import { StoreContext } from '../StoreProvider';

import type { PathOf, PathValue, StoreApi } from '../../types/StoreTypes';

type PathSetter<TState extends object, P extends PathOf<TState>> = (
  value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)
) => void;

// ['schema.pageFolders', 'count'] → [PageFolders, count]
type PathValues<TState extends object, Paths extends ReadonlyArray<PathOf<TState>>> = {
  [I in keyof Paths]: Paths[I] extends PathOf<TState> ? PathValue<TState, Paths[I]> : never;
};

// ['schema.pageFolders', 'count'] → [SetterFor<pageFolders>, SetterFor<count>]
type PathSetters<TState extends object, Paths extends ReadonlyArray<PathOf<TState>>> = {
  [I in keyof Paths]: Paths[I] extends PathOf<TState> ? PathSetter<TState, Paths[I]> : never;
};

export type MultiPathReturn<TState extends object, Paths extends ReadonlyArray<PathOf<TState>>> = [
  PathValues<TState, Paths>,
  ...PathSetters<TState, Paths>
];

export type UseStoreReturn<TState extends object, TArg> =
  TArg extends PathOf<TState>
    ? [PathValue<TState, TArg>, PathSetter<TState, TArg>]
    : TArg extends (state: TState) => infer TSelected
      ? [TSelected, StoreApi<TState>['setState']]
      : [TState, StoreApi<TState>['setState']];

function useSingleStore<TState extends object, TArg extends PathOf<TState> | ((state: TState) => unknown) | undefined>(
  store: StoreApi<TState>,
  pathOrSelector: TArg,
  equalityFn: (a: unknown, b: unknown) => boolean = Object.is
): UseStoreReturn<TState, TArg> {
  const getSnapshot = useCallback((): unknown => {
    const state = store.getState();
    if (typeof pathOrSelector === 'function') {
      return (pathOrSelector as (s: TState) => unknown)(state);
    }

    if (typeof pathOrSelector === 'string') {
      return getByPath(state, pathOrSelector as PathOf<TState>);
    }

    return state;
  }, [store, pathOrSelector]);

  const lastRef = useRef<unknown>(getSnapshot());

  const subscribe = useMemo(
    () =>
      (cb: () => void): (() => void) => {
        if (typeof pathOrSelector === 'string') {
          return store.subscribePath(pathOrSelector as PathOf<TState>, cb);
        }

        return store.subscribe(cb);
      },
    [store, pathOrSelector]
  );

  const selected = useSyncExternalStore(subscribe, () => {
    const next = getSnapshot();
    if (equalityFn(lastRef.current, next)) {
      return lastRef.current;
    }

    lastRef.current = next;

    return next;
  });

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

function useMultiStore<TState extends object, const Paths extends ReadonlyArray<PathOf<TState>>>(
  store: StoreApi<TState>,
  paths: Paths,
  equalityFn: (a: PathValues<TState, Paths>, b: PathValues<TState, Paths>) => boolean = Object.is
): MultiPathReturn<TState, Paths> {
  const pathsKey = paths.join('|');

  // Holds the last returned snapshot — returned as-is when nothing changed,
  const lastRef = useRef<PathValues<TState, Paths> | null>(null);

  const getSnapshot = useCallback((): PathValues<TState, Paths> => {
    const state = store.getState();
    let changed = lastRef.current === null;
    if (!changed) {
      for (let i = 0; i < paths.length; i++) {
        const p = paths[i];
        const prevVal = lastRef.current?.[i];
        const nextVal = getByPath(state, p);

        if (!Object.is(prevVal, nextVal)) {
          changed = true;
          break;
        }
      }
    }

    if (!changed) {
      return lastRef.current as PathValues<TState, Paths>;
    }

    const next = paths.map(p => getByPath(state, p)) as PathValues<TState, Paths>;
    if (lastRef.current !== null && equalityFn(lastRef.current, next)) {
      return lastRef.current;
    }

    lastRef.current = next;

    return next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, pathsKey, equalityFn]);

  const subscribe = useMemo(
    () =>
      (cb: () => void): (() => void) => {
        const unsubs = paths.map(p => store.subscribePath(p, cb));
        return () => unsubs.forEach(u => u());
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, pathsKey]
  );

  const selected = useSyncExternalStore(subscribe, getSnapshot);

  const setters = useMemo(
    () =>
      paths.map(
        p =>
          (value: PathValue<TState, typeof p> | ((prev: PathValue<TState, typeof p>) => PathValue<TState, typeof p>)) =>
            store.setState(p, value)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, pathsKey]
  );

  return [selected, ...setters] as unknown as MultiPathReturn<TState, Paths>;
}

function useStore<TState extends object>(): [TState, StoreApi<TState>['setState']];

function useStore<TState extends object, P extends PathOf<TState>>(
  path: P,
  equalityFn?: (a: PathValue<TState, P>, b: PathValue<TState, P>) => boolean
): [PathValue<TState, P>, PathSetter<TState, P>];

function useStore<TState extends object, TSelected>(
  selector: (state: TState) => TSelected,
  equalityFn?: (a: TSelected, b: TSelected) => boolean
): [TSelected, StoreApi<TState>['setState']];

function useStore<TState extends object, const Paths extends ReadonlyArray<PathOf<TState>>>(
  paths: Paths,
  equalityFn?: (
    a: { [K in Paths[number]]: PathValue<TState, K> },
    b: { [K in Paths[number]]: PathValue<TState, K> }
  ) => boolean
): MultiPathReturn<TState, Paths>;

function useStore<TState extends object>(
  arg?: PathOf<TState> | ReadonlyArray<PathOf<TState>> | ((state: TState) => unknown),
  equalityFn: (a: any, b: any) => boolean = Object.is
): unknown {
  const store = use(StoreContext) as StoreApi<TState> | undefined;
  if (!store) {
    throw new Error('useStore must be used inside a StoreProvider');
  }

  if (Array.isArray(arg)) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useMultiStore(store, arg as ReadonlyArray<PathOf<TState>>, equalityFn);
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useSingleStore(store, arg as PathOf<TState> | ((state: TState) => unknown) | undefined, equalityFn);
}

export default useStore;
