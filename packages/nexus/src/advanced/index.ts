// Curated entry point for the opt-in surface. Everything here is also re-exported from the package root for
// back-compat, but importing it from `@plitzi/nexus/advanced` keeps the root autocomplete focused on the Core API
// (createStore / StoreProvider / useStore / get·set·watch) that covers the common case. Reach in here only when you
// need a specific capability — entities, async, derived values, history, or the middleware pipeline.

// Escape-hatch hooks: non-reactive reads, write-only setters, cross-provider lookups.
export { default as useStoreById } from '../createStore/hooks/useStoreById';
export { default as useStoreSetter } from '../createStore/hooks/useStoreSetter';

// Feature add-ons.
export * from '../async';
export * from '../derived';
export * from '../entities';
export * from '../history';
export * from '../middleware';
