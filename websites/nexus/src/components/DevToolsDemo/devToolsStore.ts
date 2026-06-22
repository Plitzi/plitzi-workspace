import { createStoreHook } from '@plitzi/nexus/react';

export type DevToolsState = { count: number; user: { name: string } };

export const DEVTOOLS_INITIAL: DevToolsState = { count: 0, user: { name: 'Ada' } };
export const DEVTOOLS_NAME = 'nexus · website demo';

export const { useStore: useDevToolsStore } = createStoreHook<DevToolsState>();
