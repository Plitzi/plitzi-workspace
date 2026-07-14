// React integration for Nexus. The agnostic core lives in `@plitzi/nexus/core`; everything here binds it to React
// (Context, Provider, hooks). Also available as `@plitzi/nexus/react`.

export { default as StoreProvider, StoreContext, StoreRegistryContext } from './StoreProvider';
export { default as DevStoreScopeContext } from './DevStoreScopeContext';
export { findStoreInRegistry } from './StoreContext';
export { createStoreHook } from './createStoreHook';

export { default as useStore, defaultMultiEqualityFn } from './hooks/useStore';
export { default as useStoreById } from './hooks/useStoreById';
export { default as useStoreGetter } from './hooks/useStoreGetter';
export { default as useStoreSetter } from './hooks/useStoreSetter';
export { default as useStoreSync } from './hooks/useStoreSync';
export { useAsync } from './hooks/useAsync';
export { useAsyncValue } from './hooks/useAsyncValue';
export { useDerived } from './hooks/useDerived';
export { useStoreHistory } from './hooks/useStoreHistory';
export { useEntity, useEntityOne, useEntityIds, useEntityAll } from './hooks/useEntity';

export { default as useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect';

export type { StoreApi } from '../types';
export type { StoreProviderProps } from './StoreProvider';
export type { StoreRegistry } from './StoreContext';
export type { UseStoreHistoryReturn } from './hooks/useStoreHistory';
