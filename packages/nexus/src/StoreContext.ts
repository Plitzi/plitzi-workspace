/* eslint-disable @typescript-eslint/no-explicit-any */

import { createContext } from 'react';

import type { StoreApi } from './types';

const StoreContext = createContext<StoreApi<any> | undefined>(undefined);
StoreContext.displayName = 'StoreContext';

// A registry of the named (`id`) stores reachable from a point in the tree, as a linked list of `{ id, store }` nodes
// pointing at the enclosing registry. It is propagated by `StoreProvider` independently of `inherit`, so a child can
// reach an ancestor store by id *even across a disconnected (`inherit`-less) provider* that shadows `StoreContext`.
// A linked list (not a copied Map) keeps each provider O(1) — important when thousands of providers nest.
export type StoreRegistry = {
  readonly id: string;
  readonly store: StoreApi<any>;
  readonly parent: StoreRegistry | undefined;
};

const StoreRegistryContext = createContext<StoreRegistry | undefined>(undefined);
StoreRegistryContext.displayName = 'StoreRegistryContext';

// Resolves the nearest store registered under `id`, walking outward through enclosing providers.
const findStoreInRegistry = (registry: StoreRegistry | undefined, id: string): StoreApi<any> | undefined => {
  for (let node = registry; node; node = node.parent) {
    if (node.id === id) {
      return node.store;
    }
  }

  return undefined;
};

export { StoreContext, StoreRegistryContext, findStoreInRegistry };
