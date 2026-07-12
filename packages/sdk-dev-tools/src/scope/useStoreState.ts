import { useCallback, useSyncExternalStore } from 'react';

import type { DevStore } from '@plitzi/nexus';

const EMPTY: Record<string, unknown> = {};
const noop = () => () => {};

// Live state of a single store: subscribes to it and returns its cached snapshot (stable between changes). `merged`
// picks the view — the full `getState()` (own deep-merged over the parent chain) or just the scope's OWN layer, which
// is what tells nested scopes apart instead of every one reading as the merged root.
const useStoreState = (store: DevStore | undefined, merged: boolean): Record<string, unknown> => {
  const subscribe = useCallback((listener: () => void) => (store ? store.subscribe(listener) : noop()), [store]);
  const getSnapshot = useCallback(
    () => (store ? (merged ? store.getState() : store.getOwnState()) : EMPTY),
    [store, merged]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

export default useStoreState;
