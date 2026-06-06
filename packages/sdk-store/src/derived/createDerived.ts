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
export function createDerived<TState extends object, const Paths extends readonly PathOf<TState>[], R>(
  store: StoreApi<TState>,
  deps: Paths,
  compute: (values: PathValues<TState, Paths>) => R,
  options: DerivedOptions<R> = {}
): Derived<R> {
  const equalityFn = options.equalityFn ?? Object.is;
  const observable = createObservable<R>(() =>
    compute(deps.map(path => store.getPath(path)) as PathValues<TState, Paths>)
  );

  const onDependencyChange = (): void => {
    // With no subscribers, just invalidate and recompute on the next `get`. Otherwise recompute now to learn whether
    // the result changed, and wake subscribers only if it did.
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
