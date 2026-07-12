/* eslint-disable @typescript-eslint/no-explicit-any */

import type { StoreApi } from './types';

// The store shape consumers (devtools) see: an opaque object state. Internals register their own precisely-typed store,
// widened to this on the way in — a devtools panel only reads `id`/`scopePath`/`getState`/`subscribe` generically.
export type DevStore = StoreApi<Record<string, unknown>>;

// One registry entry: the store plus an optional `scopeId` (an app-defined grouping tag, e.g. the SDK instance id it
// belongs to — supplied via `DevStoreScopeContext`), an optional authoring `name` (the `<StoreProvider name>` — a
// human label of where the store comes from) and a stable `uid` for selection in a devtools dropdown.
export type DevStoreEntry = {
  uid: string;
  store: DevStore;
  scopeId?: string;
  name?: string;
};

// A process-wide registry of live stores, populated by `StoreProvider` in dev only. It exists so a devtools panel
// mounted ABOVE the scoped/element stores in the tree (where React context can't reach them) can still enumerate every
// store instance and inspect its state. Kept out of the hot path: registration happens once per store mount/unmount.

const entries = new Map<DevStore, DevStoreEntry>();
const listeners = new Set<() => void>();
let uidSeq = 0;

// A frozen array snapshot so `useSyncExternalStore` sees a stable reference between mutations (identity only changes
// when a store is added or removed, never on every render).
let snapshot: ReadonlyArray<DevStoreEntry> = [];

const emit = () => {
  snapshot = [...entries.values()];
  for (const listener of listeners) {
    listener();
  }
};

export const registerDevStore = (store: StoreApi<any>, scopeId?: string, name?: string): (() => void) => {
  const devStore = store as DevStore;
  entries.set(devStore, { uid: `dev-store-${++uidSeq}`, store: devStore, scopeId, name });
  emit();

  return () => {
    entries.delete(devStore);
    emit();
  };
};

export const subscribeDevStores = (listener: () => void): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export const getDevStoresSnapshot = (): ReadonlyArray<DevStoreEntry> => snapshot;
