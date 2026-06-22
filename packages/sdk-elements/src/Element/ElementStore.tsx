/* eslint-disable react-refresh/only-export-components */
import { createContext, use, useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { createEntityStore } from '@plitzi/nexus/entities';

import type { EntityStore } from '@plitzi/nexus/entities';
import type { Element, ElementLayout } from '@plitzi/sdk-shared';
import type { CSSProperties, ReactNode } from 'react';

// Resolved, per-instance element data. Historically carried by one React context provider per element
// (`ElementContext`); now distributed through a reactive normalized collection (`createEntityStore`), so a single
// write wakes only that element's watcher in O(1) (benchmarked perf-neutral). Identity (`id`) reaches consumers as a
// prop, so this store is the sole carrier of element data — there is no per-element context. The two store entry
// shapes mirror the two `withElement` paths: full resolution vs the JSX-manager manual-render path.
type ElementContextIdentity = {
  id: string;
  rootId?: string;
};

// Manual-render path (JSX manager): only identity is published, no resolution.
export type SkipHocElementContextValue = ElementContextIdentity & {
  plitziJsxSkipHOC: true;
};

// Full-resolution path (`withElement`): identity plus the element's resolved data. `plitziJsxSkipHOC` stays optional
// so `RootElement` can branch on it while reading a full entry; consumers (`useElement`) always see this shape.
export type ElementContextValue = ElementContextIdentity & {
  plitziJsxSkipHOC?: boolean;
  className?: string;
  plitziElementLayout?: ElementLayout;
  attributes: Element['attributes'];
  definition: Element['definition'];
  elementState: Record<string, unknown>;
  style?: CSSProperties;
  setElementState: <S extends Record<string, unknown> = Record<string, unknown>>(
    value?: S | ((prev: S) => S)
  ) => boolean;
};

export type ElementStoreEntry = ElementContextValue | SkipHocElementContextValue;

const ElementStoreContext = createContext<EntityStore<ElementStoreEntry> | null>(null);
ElementStoreContext.displayName = 'ElementStoreContext';

// One store handle per element tree (per `PlitziElementsProvider`), never a module singleton, so SSR, replicas and
// previews stay isolated. `createEntityStore` is created lazily on first render and held for the provider's lifetime.
const ElementStoreProvider = ({ children }: { children: ReactNode }) => {
  const [store] = useState(() => createEntityStore<ElementStoreEntry>());

  return <ElementStoreContext value={store}>{children}</ElementStoreContext>;
};

// Non-reactive access to the store handle (publish side: `withElement` writes here). Throws when no provider is
// mounted, since every element tree renders under `PlitziElementsProvider`.
const useElementStore = (): EntityStore<ElementStoreEntry> => {
  const store = use(ElementStoreContext);
  if (!store) {
    throw new Error('useElementStore must be used under <PlitziElementsProvider> (mounts <ElementStoreProvider>)');
  }

  return store;
};

// Publish side (`withElement`): writes the resolved entry to the store during render so a descendant's
// `useElementData(id)` reads it on first paint, and removes it on unmount. The write runs every render (cheap, the
// entry is memoized upstream); the cleanup is keyed by id.
const usePublishElement = (entry: ElementStoreEntry): void => {
  const store = useElementStore();
  const { id } = entry;
  store.setOne(entry);

  useEffect(() => () => store.removeOne(id), [store, id]);
};

// Reactive read of one element's resolved data; re-renders only when that element changes, never for a sibling.
// Reads through `useSyncExternalStore` (tearing-safe); yields `undefined` when the id is not yet published. A
// manual-render (skipHOC) entry is surfaced as the full shape, matching the legacy contract — `RootElement` branches
// on `plitziJsxSkipHOC` before touching the resolved-only fields.
const useElementData = (id: string): ElementContextValue | undefined => {
  const store = useElementStore();
  const subscribe = useCallback((onChange: () => void) => store.subscribeOne(id, onChange), [store, id]);
  const getSnapshot = useCallback(() => store.getOne(id), [store, id]);
  const data = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return data as ElementContextValue | undefined;
};

export { ElementStoreContext, ElementStoreProvider, useElementStore, usePublishElement, useElementData };
