// Public surface, organized into two tiers. CORE is what most consumers learn: create a store, provide it, and read
// or write by path with `useStore` (hook) or `store.get` / `store.set` / `store.watch` (imperative). ADVANCED — the
// opt-in add-ons (entities, async, derived, history, middleware) and the escape-hatch hooks — is also re-exported
// here for back-compat, but the curated `@plitzi/nexus/advanced` entry point exposes the same symbols with a smaller,
// focused autocomplete. Nothing is removed from the root: importing from the root keeps working everywhere.

import createStore from './createStore';
import useStoreById from './createStore/hooks/useStoreById';
import useStoreSetter from './createStore/hooks/useStoreSetter';
import StoreProvider from './StoreProvider';

// --- Core ---
export * from './createStore';
export * from './StoreProvider';
export * from './types';

export { createStore, StoreProvider };

// --- Advanced (also available, with a smaller surface, from '@plitzi/nexus/advanced') ---
export * from './async';
export * from './derived';
export * from './entities';
export * from './history';
export * from './middleware';
export * from './createStore/hooks/useStoreSetter';
export * from './createStore/hooks/useStoreById';

export { useStoreById, useStoreSetter };

export { setCodegenEnabled } from './createStore/helpers/writeByPath';
export { createServerSnapshot, isServerSnapshot } from './rsc';
