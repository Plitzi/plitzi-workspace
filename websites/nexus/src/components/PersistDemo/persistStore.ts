import { createStore, createStoreHook, persistMiddleware } from '@plitzi/nexus';

export type PersistState = { clicks: number; note: string };

const STORAGE_KEY = 'plitzi-nexus:persist-demo';
export const PERSIST_INITIAL: PersistState = { clicks: 0, note: '' };

// A real store wired with the persist middleware. It hydrates from localStorage the moment this module loads, and
// mirrors every change back — so the values survive a page reload.
export const persistStore = createStore<PersistState>(PERSIST_INITIAL, {
  middlewares: [persistMiddleware({ key: STORAGE_KEY, debounce: 150 })]
});

export const resetPersist = () => persistStore.setState(undefined, PERSIST_INITIAL);

export const { useStore: usePersistStore } = createStoreHook<PersistState>();
