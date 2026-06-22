import { createStoreHook } from '@plitzi/nexus/react';

export type AppState = {
  count: number;
  user: { name: string };
};

export const { useStore } = createStoreHook<AppState>();
