import type { DevStore, DevStoreEntry } from '@plitzi/nexus';

export type ScopeOption = { label: string; value: string };
export type ScopeOptionGroup = { label: string; options: ScopeOption[] };

// A last-resort name for an anonymous scope (no `name`/`scopePath`/`id`): the keys it adds on top of its root store, so
// two segment-less live scopes read differently instead of both collapsing to "scope".
const ownKeysLabel = (store: DevStore, rootKeys: ReadonlySet<string> | undefined): string | undefined => {
  if (!rootKeys) {
    return undefined;
  }

  const own = Object.keys(store.getState()).filter(key => !rootKeys.has(key));

  return own.length > 0 ? `{ ${own.slice(0, 4).join(', ')} }` : undefined;
};

// A human label for a store entry, best-to-worst: the authoring `name` (where it comes from), its `scopePath`, its
// `id`, its own keys, then a generic marker — "root" only for the untagged app root, "scope" for anonymous nested ones.
export const storeLabel = (entry: DevStoreEntry, rootKeys?: ReadonlySet<string>): string => {
  const { store, name, scopeId } = entry;
  if (name) {
    return store.scopePath ? `${name} · ${store.scopePath}` : name;
  }

  if (store.scopePath) {
    return store.scopePath;
  }

  if (store.id) {
    return store.id;
  }

  if (scopeId === undefined) {
    return 'root';
  }

  return ownKeysLabel(store, rootKeys) ?? 'scope';
};

// The keys of the untagged app root, used to describe anonymous nested scopes by what they add on top of it.
export const rootKeysOf = (entries: ReadonlyArray<DevStoreEntry>): ReadonlySet<string> | undefined => {
  const root = entries.find(entry => entry.scopeId === undefined);

  return root ? new Set(Object.keys(root.store.getState())) : undefined;
};

// Group registry entries into `<optgroup>`-shaped groups, one per SDK instance. Nested providers carry their instance's
// `scopeId`; the root store (created above the dev-tools container, so it can't be tagged from below) is untagged and
// shown under the active instance.
export const buildScopeOptions = (
  entries: ReadonlyArray<DevStoreEntry>,
  instanceIds: ReadonlyArray<string>,
  activeInstanceId: string | undefined
): ScopeOptionGroup[] => {
  const rootKeys = rootKeysOf(entries);

  return instanceIds.map(instanceId => ({
    label: instanceId,
    options: entries
      .filter(entry => entry.scopeId === instanceId || (entry.scopeId === undefined && instanceId === activeInstanceId))
      .map(entry => ({ label: storeLabel(entry, rootKeys), value: entry.uid }))
  }));
};

// The store the panel shows: an explicit, still-mounted pick; otherwise the root store (untagged) as the default.
export const resolveSelectedUid = (
  entries: ReadonlyArray<DevStoreEntry>,
  selectedUid: string | undefined
): string | undefined => {
  if (selectedUid && entries.some(entry => entry.uid === selectedUid)) {
    return selectedUid;
  }

  return (entries.find(entry => entry.scopeId === undefined) ?? entries.at(0))?.uid;
};
