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
 * The records that describe something actually being kept.
 *
 * A write of `ttl: 0` records a path that is stale the instant it lands — the query cache's way of holding an answer
 * it will never serve: what an UNCACHED provider gets for every answer, and what a cached one gets for an answer it
 * may not trust. There is no time left to show and nothing to expire, so listing them filled the panel with the
 * queries that have no cache at all.
 */
const kept = (records: Readonly<Record<string, PathFreshness>>): Readonly<Record<string, PathFreshness>> =>
  Object.fromEntries(Object.entries(records).filter(([, record]) => record.ttl > 0));

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
  // Keyed by the store's own snapshot, which it hands out unchanged until a record changes: the filtered object has
  // to keep an identity of its own, or `getSnapshot` would answer differently on every call and never settle.
  const filtered = useRef(new WeakMap<object, Readonly<Record<string, PathFreshness>>>());

  const subscribe = useCallback(
    (listener: () => void) => {
      const unsubscribes = entries.map(({ store }) => store.watchFreshness(listener));

      return () => unsubscribes.forEach(unsubscribe => unsubscribe());
    },
    [entries]
  );

  const getSnapshot = useCallback(() => {
    const next = entries
      .map(entry => {
        const records = entry.store.getFreshnessRecords();
        let held = filtered.current.get(records);
        if (!held) {
          held = kept(records);
          filtered.current.set(records, held);
        }

        return { entry, records: held };
      })
      .filter(group => Object.keys(group.records).length > 0);
    if (!sameGroups(cache.current, next)) {
      cache.current = next.length > 0 ? next : EMPTY;
    }

    return cache.current;
  }, [entries]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

export default useFreshnessByStore;
