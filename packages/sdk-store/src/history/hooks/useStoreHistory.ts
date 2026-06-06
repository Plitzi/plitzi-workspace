import { useEffect, useSyncExternalStore } from 'react';

import { useResolvedStore } from '../../createStore/hooks/shared';
import { getStoreHistory } from '../../middleware/historyMiddleware';

import type { HistorySnapshot } from '../../middleware/historyMiddleware';

export type UseStoreHistoryReturn<TState> = HistorySnapshot<TState> & {
  undo: () => void;
  redo: () => void;
  travelTo: (index: number) => void;
  clear: () => void;
};

// Stable empty view for a store with no history (no `historyMiddleware()` added). Lets the devtools History tab and
// any consumer render gracefully ("No history yet") instead of crashing.
const EMPTY_SNAPSHOT: HistorySnapshot<never> = { entries: [], index: -1, canUndo: false, canRedo: false };
const noop = () => {};
const subscribeNone = () => noop;
const getEmptySnapshot = () => EMPTY_SNAPSHOT;

// Warn once per store (outside production) when the hook is used without `historyMiddleware()` — the view will be
// empty and the controls no-ops, which is an easy mistake to take for a real-but-blank history.
const warned = new WeakSet<object>();
const warnMissingMiddleware = (store: object): void => {
  if (import.meta.env.MODE === 'production' || warned.has(store)) {
    return;
  }

  warned.add(store);
  console.warn(
    '[sdk-store] useStoreHistory: this store has no history. Add `historyMiddleware()` to its middlewares to ' +
      'record an action log — until then the hook returns an empty, no-op view.'
  );
};

// Reactive view of the resolved store's history (action log + time-travel). Re-renders when entries or the current
// index change. The controls are stable across renders. Requires `historyMiddleware()` on the store; without it the
// view is empty and the controls are no-ops (and a dev-only warning is logged).
export function useStoreHistory<TState extends object>(): UseStoreHistoryReturn<TState> {
  const store = useResolvedStore<TState>(undefined, 'useStoreHistory');
  const history = getStoreHistory<TState>(store);

  useEffect(() => {
    if (!history) {
      warnMissingMiddleware(store);
    }
  }, [history, store]);

  // The empty snapshot's `never` entries are assignable to any `TState`, so it stands in for a store with no history.
  const getSnapshot = history?.getSnapshot ?? getEmptySnapshot;
  const snapshot = useSyncExternalStore(history?.subscribe ?? subscribeNone, getSnapshot, getSnapshot);

  return {
    ...snapshot,
    undo: history?.undo ?? noop,
    redo: history?.redo ?? noop,
    travelTo: history?.travelTo ?? noop,
    clear: history?.clear ?? noop
  };
}
