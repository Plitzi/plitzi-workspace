/* eslint-disable react-refresh/only-export-components */
import { createContext, use, useCallback, useState, useSyncExternalStore } from 'react';

import { createEntityStore } from '@plitzi/nexus/entities';

import type { Element, ElementLayout } from '../types';
import type { EntityStore } from '@plitzi/nexus/entities';
import type { CSSProperties, ReactNode } from 'react';

// Resolved, per-instance element data. Historically carried by one React context provider per element
// (`ElementContext`); now distributed through a reactive normalized collection (`createEntityStore`), so a single
// write wakes only that element's watcher in O(1) (benchmarked perf-neutral). Identity (`id`) reaches consumers as a
// prop, so this store is the sole carrier of element data — there is no per-element context. The `full`/`skipHOC`
// discriminant mirrors the two `withElement` paths: full resolution vs the JSX-manager manual-render path.
export type ElementContextValue<T extends 'skipHOC' | 'full' = 'full'> = {
  id: string;
  rootId?: string;
} & (T extends 'skipHOC'
  ? { plitziJsxSkipHOC: true }
  : {
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
    });

export type ElementStoreEntry = ElementContextValue | ElementContextValue<'skipHOC'>;

const ElementStoreContext = createContext<EntityStore<ElementStoreEntry> | null>(null);
ElementStoreContext.displayName = 'ElementStoreContext';

// One store handle per element tree (per `PlitziServiceProvider`), never a module singleton, so SSR, replicas and
// previews stay isolated. `createEntityStore` is created lazily on first render and held for the provider's lifetime.
const ElementStoreProvider = ({ children }: { children: ReactNode }) => {
  const [store] = useState(() => createEntityStore<ElementStoreEntry>());

  return <ElementStoreContext value={store}>{children}</ElementStoreContext>;
};

// Non-reactive access to the store handle (publish side: `withElement` writes here). Throws when no provider is
// mounted, since every element tree renders under `PlitziServiceProvider`.
const useElementStore = (): EntityStore<ElementStoreEntry> => {
  const store = use(ElementStoreContext);
  if (!store) {
    throw new Error('useElementStore must be used under <PlitziServiceProvider> (mounts <ElementStoreProvider>)');
  }

  return store;
};

// Reactive read of one element's resolved data; re-renders only when that element changes, never for a sibling.
// Reads through `useSyncExternalStore` (tearing-safe); yields `undefined` when the id is not yet published.
const useElementData = <T extends 'skipHOC' | 'full' = 'full'>(id: string): ElementContextValue<T> | undefined => {
  const store = useElementStore();
  const subscribe = useCallback((onChange: () => void) => store.subscribeOne(id, onChange), [store, id]);
  const getSnapshot = useCallback(() => store.getOne(id), [store, id]);
  const data = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return data as ElementContextValue<T> | undefined;
};

export { ElementStoreContext, ElementStoreProvider, useElementStore, useElementData };
