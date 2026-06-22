import { computed, onScopeDispose, shallowRef } from 'vue';

import { injectStore } from './injection';
import { isProd } from '../env';
import { getStoreHistory } from '../middleware/historyMiddleware';

import type { HistorySnapshot } from '../middleware/historyMiddleware';
import type { StoreApi } from '../types';
import type { ComputedRef } from 'vue';

export type UseStoreHistoryReturn<TState> = HistorySnapshot<TState> & {
  undo: () => void;
  redo: () => void;
  travelTo: (index: number) => void;
  clear: () => void;
};

const EMPTY_SNAPSHOT: HistorySnapshot<never> = { entries: [], index: -1, canUndo: false, canRedo: false };
const noop = () => {};

const warned = new WeakSet<object>();
const warnMissingMiddleware = (store: object): void => {
  if (isProd || warned.has(store)) {
    return;
  }

  warned.add(store);
  console.warn(
    '[nexus] useStoreHistory: this store has no history. Add `historyMiddleware()` to its middlewares to ' +
      'record an action log — until then the composable returns an empty, no-op view.'
  );
};

// Reactive view of the resolved store's history (action log + time-travel). Updates when entries or the current index
// change. Requires `historyMiddleware()` on the store; without it the view is empty and the controls are no-ops.
export function useStoreHistory<TState extends object>(options?: {
  store?: StoreApi<TState>;
}): ComputedRef<UseStoreHistoryReturn<TState>> {
  const store = options?.store ?? injectStore<TState>();
  const history = getStoreHistory<TState>(store);

  if (!history) {
    warnMissingMiddleware(store);
  }

  const snapshot = shallowRef<HistorySnapshot<TState>>(history ? history.getSnapshot() : EMPTY_SNAPSHOT);
  if (history) {
    onScopeDispose(
      history.subscribe(() => {
        snapshot.value = history.getSnapshot();
      })
    );
  }

  const actions = {
    undo: history?.undo ?? noop,
    redo: history?.redo ?? noop,
    travelTo: history?.travelTo ?? noop,
    clear: history?.clear ?? noop
  };

  return computed(() => ({ ...snapshot.value, ...actions }));
}
