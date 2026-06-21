import { persistMiddleware } from '@plitzi/nexus';

import type { PathOf, StoreMiddleware } from '@plitzi/nexus';

// One persistence convention for the whole arcade: every store saves under a `nexus.` key in localStorage, so a refresh
// restores your settings and progress — and a single purge can wipe them all by prefix.
export const PERSIST_PREFIX = 'nexus.';

export const persistKey = (name: string): string => `${PERSIST_PREFIX}${name}`;

export const arcadePersist = <T extends object>(name: string, paths?: ReadonlyArray<PathOf<T>>): StoreMiddleware<T> =>
  persistMiddleware<T>({ key: persistKey(name), storage: 'local', paths });

// Removes a single store's save without touching the others — the per-game purge.
export const purgeSave = (key: string): void => {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // Storage can be unavailable (privacy mode, SSR) — nothing to purge.
  }
};

// Clears every arcade save (settings, scores, 2048/tic-tac-toe boards, trash-flow stats, the reactor empire, the log
// dock) and reloads so all stores re-hydrate empty. Matches both `nexus.*` keys and the reactor's `nexus-reactor-*`.
export const purgeArcadeData = (): void => {
  try {
    const storage = globalThis.localStorage;
    if (storage) {
      for (const key of Object.keys(storage)) {
        if (/^nexus[.-]/.test(key)) {
          storage.removeItem(key);
        }
      }
    }
  } catch {
    // Storage can be unavailable (privacy mode, SSR) — nothing to purge.
  }

  globalThis.location?.reload();
};
