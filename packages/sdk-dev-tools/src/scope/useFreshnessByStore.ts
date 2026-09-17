import { useCallback, useRef, useSyncExternalStore } from 'react';

import type { DevStoreEntry, PathFreshness } from '@plitzi/nexus';

export type FreshnessGroup = {
  entry: DevStoreEntry;
  records: Readonly<Record<string, PathFreshness>>;
};

const EMPTY: ReadonlyArray<FreshnessGroup> = [];

const sameGroups = (a: ReadonlyArray<FreshnessGroup>, b: ReadonlyArray<FreshnessGroup>): boolean =>
  a.length === b.length &&
  a.every((group, index) => group.entry === b[index].entry && group.records === b[index].records);

/**
 * The paths written with a TTL, across every store given — the stores that hold none are left out.
 *
 * Across all of them because the one holding a TTL is rarely the one being looked at: a provider's answers live in the
 * query cache, not in the provider's own scope, and a panel that only read the picked store showed nothing unless its
 * reader already knew where to look. Each store hands out the same records object until one changes, so the list is
 * rebuilt only when something did.
 */
const useFreshnessByStore = (entries: ReadonlyArray<DevStoreEntry>): ReadonlyArray<FreshnessGroup> => {
  const cache = useRef<ReadonlyArray<FreshnessGroup>>(EMPTY);

  const subscribe = useCallback(
    (listener: () => void) => {
      const unsubscribes = entries.map(({ store }) => store.watchFreshness(listener));

      return () => unsubscribes.forEach(unsubscribe => unsubscribe());
    },
    [entries]
  );

  const getSnapshot = useCallback(() => {
    const next = entries
      .map(entry => ({ entry, records: entry.store.getFreshnessRecords() }))
      .filter(group => Object.keys(group.records).length > 0);
    if (!sameGroups(cache.current, next)) {
      cache.current = next.length > 0 ? next : EMPTY;
    }

    return cache.current;
  }, [entries]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

export default useFreshnessByStore;
