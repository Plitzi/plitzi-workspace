// Package root = the framework-agnostic core. Zero React: create a store and read/write/subscribe imperatively
// (`store.get` / `store.set` / `store.watch`), compose middlewares, and use the async/derived/entities primitives.
//
// React bindings (Provider + hooks) live in `@plitzi/nexus/react`; Next.js helpers in `@plitzi/nexus/next`.

export { default as createStore } from './createStore/createStore';
export { setCodegenEnabled } from './createStore/helpers/writeByPath';

export { createAsync } from './async/createAsync';
export { createDerived } from './derived/createDerived';

export { createEntityAdapter } from './entities/createEntityAdapter';
export { createEntityStore } from './entities/createEntityStore';

export { loggerMiddleware } from './middleware/loggerMiddleware';
export { persistMiddleware } from './middleware/persistMiddleware';
export { historyMiddleware } from './middleware/historyMiddleware';
export { reduxDevToolsMiddleware } from './middleware/reduxDevToolsMiddleware';
export { createRecorder } from './middleware/recorderMiddleware';
export { cascade } from './middleware/cascade';
export { getStoreHistory } from './middleware/historyMiddleware';

export { createServerSnapshot, isServerSnapshot } from './rsc';

export { registerDevStore, subscribeDevStores, getDevStoresSnapshot } from './devStoreRegistry';
export type { DevStore, DevStoreEntry } from './devStoreRegistry';

export * from './types';

export type { CreateStoreOptions } from './createStore/createStore';
export type { AsyncOptions, AsyncResource, AsyncSnapshot, AsyncStatus } from './async/createAsync';
export type { Derived, DerivedOptions } from './derived/createDerived';
export type {
  EntityAdapter,
  EntityAdapterOptions,
  EntityId,
  EntityMap,
  EntityUpdate,
  EntityUpdater
} from './entities/createEntityAdapter';
export type { EntityStore, EntityStoreOptions, EntityChangeListener } from './entities/createEntityStore';
export type { LoggerOptions } from './middleware/loggerMiddleware';
export type {
  PersistOptions,
  PersistStorage,
  PersistTarget,
  PersistTargetOption
} from './middleware/persistMiddleware';
export type { ReduxDevToolsOptions } from './middleware/reduxDevToolsMiddleware';
export type { Recorder, RecorderEntry, RecorderOptions } from './middleware/recorderMiddleware';
export type { HistoryEntry, HistorySnapshot, StoreHistory, StoreHistoryOptions } from './middleware/historyMiddleware';
