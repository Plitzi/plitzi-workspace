// The event-driven building block shared by `createDerived`, `createAsync` and anything else that exposes a value
// recomputed from store events: a lazily-recomputed value with its own subscriber set. `get()` recomputes only when
// marked dirty (so reads between changes are O(1) and referentially stable); `invalidate()` marks it dirty; `notify()`
// wakes subscribers. The owner wires a store subscription to call `invalidate`/`notify` — the primitive stays
// agnostic about *when* to notify (derived notifies only when the result changes; async notifies on every event), so
// each consumer keeps its own policy while shedding the duplicated dirty-flag + listener-set bookkeeping.
export type Observable<T> = {
  // Current value, recomputed only if invalidated since the last read.
  get: () => T;
  // Mark the value stale so the next `get()` recomputes.
  invalidate: () => void;
  // Wake every subscriber. Pair with `invalidate()` when a source event changes the value.
  notify: () => void;
  subscribe: (listener: () => void) => () => void;
  hasListeners: () => boolean;
  destroy: () => void;
};

export function createObservable<T>(compute: () => T): Observable<T> {
  const listeners = new Set<() => void>();
  let value: T;
  let dirty = true;

  return {
    get: () => {
      if (dirty) {
        value = compute();
        dirty = false;
      }

      return value;
    },
    invalidate: () => {
      dirty = true;
    },
    notify: () => {
      listeners.forEach(listener => listener());
    },
    subscribe: listener => {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    hasListeners: () => listeners.size > 0,
    destroy: () => listeners.clear()
  };
}
