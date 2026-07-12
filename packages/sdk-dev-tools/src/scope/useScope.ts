import { useCallback, useMemo } from 'react';

import { selectInstance, useDevInstances } from '../instanceRegistry';
import { buildScopeOptions, resolveSelectedUid } from './helpers';
import { selectStore, useSelectedStoreUid } from './storeSelection';
import useDevStores from './useDevStores';

import type { ScopeOptionGroup } from './helpers';
import type { DevStore } from '@plitzi/nexus';

export type ScopeSelector = {
  options: ScopeOptionGroup[];
  value: string | undefined;
  onSelect: (uid: string) => void;
};

// Drives the header's global scope dropdown: options grouped by instance (each holding its StoreProviders), the current
// value, and a handler that both re-targets the panel to the store's instance and remembers the store for the Store tab.
export const useScopeSelector = (): ScopeSelector => {
  const entries = useDevStores();
  const { instanceIds, selectedId } = useDevInstances();
  const selectedUid = useSelectedStoreUid();

  const options = useMemo(
    () => buildScopeOptions(entries, instanceIds, selectedId),
    [entries, instanceIds, selectedId]
  );
  const value = useMemo(() => resolveSelectedUid(entries, selectedUid), [entries, selectedUid]);

  const onSelect = useCallback(
    (uid: string) => {
      const entry = entries.find(candidate => candidate.uid === uid);
      // Picking a store from another instance's group makes that instance render the panel.
      if (entry?.scopeId) {
        selectInstance(entry.scopeId);
      }

      selectStore(uid);
    },
    [entries]
  );

  return { options, value, onSelect };
};

// The store the Store tab currently shows, resolved from the same shared selection the header dropdown drives.
export const useSelectedStore = (): DevStore | undefined => {
  const entries = useDevStores();
  const selectedUid = useSelectedStoreUid();
  const uid = useMemo(() => resolveSelectedUid(entries, selectedUid), [entries, selectedUid]);

  return useMemo(() => entries.find(entry => entry.uid === uid)?.store, [entries, uid]);
};
