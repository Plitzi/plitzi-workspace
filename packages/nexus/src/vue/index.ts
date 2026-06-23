// Vue integration for Nexus. The agnostic core lives in `@plitzi/nexus`; everything here binds it to Vue 3
// reactivity (provide/inject + composables returning refs). Also available as `@plitzi/nexus/vue`.

export { provideStore, injectStore } from './injection';
export { useStore, useStoreValue, createStoreComposable } from './useStore';
export { useEntity, useEntityOne, useEntityIds, useEntityAll } from './useEntity';
export { useDerived } from './useDerived';
export { useAsync } from './useAsync';
export { useStoreHistory } from './useStoreHistory';

export type { UseStoreOptions } from './useStore';
export type { UseStoreHistoryReturn } from './useStoreHistory';
