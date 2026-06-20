import { useSyncExternalStore } from 'react';

import { createStore, loggerMiddleware } from '@plitzi/nexus';

import { pushLog } from './heroLog';

// One Nexus store backs every global arcade toggle. Flipping pause / perf / debug / mute / auto-idle is a real store
// write, so it streams through the same `loggerMiddleware` sink as the games — you can literally watch `paused: true`
// land in the log panel. The canvas loops read these flags synchronously each frame via `getControl` (a plain
// `store.get`), while React surfaces subscribe through `useControl`. Everything the arcade does flows through Nexus.
export type ArcadeControls = {
  paused: boolean;
  lowPerf: boolean;
  debug: boolean;
  muted: boolean;
  autoIdle: boolean;
};

const INITIAL: ArcadeControls = { paused: false, lowPerf: false, debug: false, muted: false, autoIdle: false };

export const controlsStore = createStore<ArcadeControls>(INITIAL, {
  middlewares: [loggerMiddleware<ArcadeControls>(change => pushLog(change.path ?? '(root)', change.next))]
});

// Nexus's path-value generics don't simplify against a generic `K extends keyof T`, so the by-path facade is reached
// through narrow local casts. At runtime these are plain top-level reads/writes/subscriptions — type-safe by
// construction, and they keep the clean per-path log line (`paused: true`) instead of a whole-object root write.
type SetByKey = (key: keyof ArcadeControls, value: boolean) => void;
type WatchByKey = (key: keyof ArcadeControls, listener: () => void) => () => void;

export const getControl = <K extends keyof ArcadeControls>(key: K): ArcadeControls[K] => controlsStore.getState()[key];

export const setControl = <K extends keyof ArcadeControls>(key: K, value: ArcadeControls[K]): void => {
  (controlsStore.set as unknown as SetByKey)(key, value);
};

export const toggleControl = (key: keyof ArcadeControls): void => setControl(key, !getControl(key));

export const useControl = <K extends keyof ArcadeControls>(key: K): ArcadeControls[K] =>
  useSyncExternalStore(
    cb => (controlsStore.watch as unknown as WatchByKey)(key, cb),
    () => getControl(key)
  );
