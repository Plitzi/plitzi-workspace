import { createStoreHook } from '@plitzi/sdk-store';

export type MiddlewareState = { count: number; user: { name: string } };
export type ChildState = { ping: number };

export const MIDDLEWARE_INITIAL: MiddlewareState = { count: 0, user: { name: 'Ada' } };
export const CHILD_INITIAL: ChildState = { ping: 0 };
export const PERSIST_KEY = 'sdk-store-mw-demo';

export type LogEntry = { id: number; path: string; value: string };

export const { useStore: useMwStore } = createStoreHook<MiddlewareState>();
export const { useStore: useChildStore } = createStoreHook<ChildState>();
