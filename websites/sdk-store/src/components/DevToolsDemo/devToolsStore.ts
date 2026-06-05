import { createStoreHook } from '@plitzi/sdk-store';

export type DevToolsState = { count: number; user: { name: string } };

export const DEVTOOLS_INITIAL: DevToolsState = { count: 0, user: { name: 'Ada' } };
export const DEVTOOLS_NAME = 'sdk-store · website demo';

export const { useStore: useDevToolsStore } = createStoreHook<DevToolsState>();
