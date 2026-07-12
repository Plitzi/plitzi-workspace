import { useSyncExternalStore } from 'react';

import { getDevStoresSnapshot, subscribeDevStores } from '@plitzi/nexus';

import type { DevStoreEntry } from '@plitzi/nexus';

// The live list of every nexus store registered in the tree (dev only), each tagged with the SDK instance it belongs
// to. Re-renders when a store mounts or unmounts, not on every state change — the snapshot is stable between changes.
const useDevStores = (): ReadonlyArray<DevStoreEntry> =>
  useSyncExternalStore(subscribeDevStores, getDevStoresSnapshot, getDevStoresSnapshot);

export default useDevStores;
