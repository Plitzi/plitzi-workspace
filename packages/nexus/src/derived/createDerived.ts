import { createObservable } from '../helpers/createObservable';

import type { PathOf, PathValues, StoreApi } from '../types';

export type Derived<R> = {
  // Current value, recomputed lazily if a dependency changed since the last read.
  get: () => R;
  // Wakes `listener` only when the computed value actually changes.
  subscribe: (listener: () => void) => () => void;
  destroy: () => void;
};

export type DerivedOptions<R> = {
  equalityFn?: (a: R, b: R) => boolean;
};

// A memoized value computed from store paths — the store's answer to reselect / Jotai derived atoms / MobX computed.
// It recomputes only when one of its `deps` changes and only notifies subscribers when the *result* changes, so a
// dependency edit that doesn't affect the output costs nothing downstream. Define `total` once, read it everywhere.
// The compute function receives the changed path as a second argument so callers can write incremental updates
// (e.g., O(1) delta recompute instead of O(n) full sum) by storing previous values in a closure.
export function createDerived<TState extends object, const Paths extends readonly PathOf<TState>[], R>(
  store: StoreApi<TState>,
  deps: Paths,
  compute: (values: PathValues<TState, Paths>, changedPath?: string) => R,
  options: DerivedOptions<R> = {}
): Derived<R> {
  const equalityFn = options.equalityFn ?? Object.is;
  let lastChangedPath: string | undefined;

  const observable = createObservable<R>(() => {
    const path = lastChangedPath;

    lastChangedPath = undefined;

    return compute(deps.map(p => store.getPath(p)) as PathValues<TState, Paths>, path);
  });

  const onDependencyChange = (changedPath?: string): void => {
    lastChangedPath = changedPath;

    if (!observable.hasListeners()) {
      observable.invalidate();

      return;
    }

    const prev = observable.get();
    observable.invalidate();
    if (!equalityFn(prev, observable.get())) {
      observable.notify();
    }
  };

  const unsubscribes = deps.map(path => store.subscribePath(path, onDependencyChange));

  return {
    get: observable.get,
    subscribe: listener => {
      observable.get();

      return observable.subscribe(listener);
    },
    destroy: () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
      observable.destroy();
    }
  };
}
