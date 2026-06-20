import { createStore, createStoreHook, persistMiddleware } from '@plitzi/nexus';

// The log dock's open/width preferences, persisted with `persistMiddleware` — so a refresh keeps your panel exactly
// as you left it. Another Nexus capability, used for real.
export type DockState = {
  open: boolean;
  width: number;
};

export const createDockStore = () =>
  createStore<DockState>(
    { open: true, width: 320 },
    { middlewares: [persistMiddleware<DockState>({ key: 'nexus.logdock', storage: 'local' })] }
  );

export const { useStore: useDock, useStoreSetter: useDockSetter } = createStoreHook<DockState>();
