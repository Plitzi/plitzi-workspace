import { useCallback, useSyncExternalStore } from 'react';

import type { DevStore, PathFreshness } from '@plitzi/nexus';

const EMPTY: Readonly<Record<string, PathFreshness>> = {};
const noop = () => () => {};

// The paths a store holds with a TTL, live: re-read whenever one is written, expired, runs out or goes away.
const useFreshnessRecords = (store: DevStore | undefined): Readonly<Record<string, PathFreshness>> => {
  const subscribe = useCallback((listener: () => void) => (store ? store.watchFreshness(listener) : noop()), [store]);
  const getSnapshot = useCallback(() => (store ? store.getFreshnessRecords() : EMPTY), [store]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

export default useFreshnessRecords;
