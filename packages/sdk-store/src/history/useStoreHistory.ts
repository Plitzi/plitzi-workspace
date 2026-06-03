import { useSyncExternalStore } from 'react';

import { getStoreHistory } from './createStoreHistory';
import { useResolvedStore } from '../hooks/shared';

import type { HistorySnapshot, StoreHistoryOptions } from './createStoreHistory';

export type UseStoreHistoryReturn<TState> = HistorySnapshot<TState> & {
  undo: () => void;
  redo: () => void;
  travelTo: (index: number) => void;
  clear: () => void;
};

// Reactive view of the resolved store's history (action log + time-travel). Re-renders when entries or the
// current index change. The controls are stable across renders.
export function useStoreHistory<TState extends object>(options?: StoreHistoryOptions): UseStoreHistoryReturn<TState> {
  const store = useResolvedStore<TState>(undefined, 'useStoreHistory');
  const history = getStoreHistory<TState>(store, options);
  const snapshot = useSyncExternalStore(history.subscribe, history.getSnapshot, history.getSnapshot);

  return {
    ...snapshot,
    undo: history.undo,
    redo: history.redo,
    travelTo: history.travelTo,
    clear: history.clear
  };
}
