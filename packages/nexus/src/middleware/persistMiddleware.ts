import { isDisabled } from './isDisabled';
import getByPath from '../helpers/getByPath';
import isPathAffected from '../helpers/isPathAffected';

import type { MiddlewareOptions, PathOf, StoreApi, StoreMiddleware } from '../types';

export type PersistStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export type PersistTarget = PersistStorage | 'local' | 'session';

// A fixed target, or a resolver read per operation so the destination — or whether to persist at all (`false`) —
// can depend on state.
export type PersistTargetOption<TState extends object> = PersistTarget | ((state: TState) => PersistTarget | false);

export type PersistOptions<TState extends object> = MiddlewareOptions<TState> & {
  key: string;
  storage?: PersistTargetOption<TState>;
  // Persist only these subtrees and rehydrate each in place. Takes precedence over `partialize`.
  paths?: ReadonlyArray<PathOf<TState>>;
  partialize?: (state: TState) => Partial<TState>;
  version?: number;
  migrate?: (persisted: unknown, version: number) => unknown;
  // Not used in `paths` mode, where each path is restored at its own location.
  merge?: (persisted: Partial<TState>, current: TState) => Partial<TState>;
};

const resolveStorage = (target: PersistTarget = 'local'): PersistStorage | undefined => {
  if (typeof target !== 'string') {
    return target;
  }

  try {
    return target === 'session' ? globalThis.sessionStorage : globalThis.localStorage;
  } catch {
    // Reading `*Storage` can throw (privacy modes) rather than being undefined.
    return undefined;
  }
};

type Envelope = { version: number; state: unknown };

// Mirrors the store to a key/value storage and rehydrates on creation. Place it first in `middlewares` so it hydrates
// before logger/history observe anything.
export const persistMiddleware = <TState extends object>(options: PersistOptions<TState>): StoreMiddleware<TState> => {
  const { key, storage: target, paths, partialize, version = 0, migrate, merge, enabled } = options;
  const dynamicTarget = typeof target === 'function' ? target : undefined;
  const staticStorage = typeof target === 'function' ? undefined : resolveStorage(target);

  // A fixed target that isn't reachable skips the whole middleware; a dynamic one is resolved per operation instead.
  if (!dynamicTarget && !staticStorage) {
    return () => undefined;
  }

  const storageFor = (state: TState): PersistStorage | undefined => {
    if (!dynamicTarget) {
      return staticStorage;
    }

    const resolved = dynamicTarget(state);

    return resolved ? resolveStorage(resolved) : undefined;
  };

  const buildPayload = (state: TState): unknown => {
    if (paths) {
      const fragment: Record<string, unknown> = {};
      for (const path of paths) {
        fragment[path] = getByPath(state, path);
      }

      return fragment;
    }

    return partialize ? partialize(state) : state;
  };

  const write = (api: StoreApi<TState>): void => {
    const state = api.getState();
    const storage = storageFor(state);
    if (!storage) {
      return;
    }

    const payload: Envelope = { version, state: buildPayload(state) };
    storage.setItem(key, JSON.stringify(payload));
  };

  // `onChange` observes EVERY committed change. In `paths` mode, only persisted subtrees matter — writing on
  // unrelated changes is wasteful and, worse, can clobber the stored value with a not-yet-hydrated one during boot.
  const affectsPersisted = (changedPath: PathOf<TState> | undefined): boolean =>
    !paths || paths.some(path => isPathAffected(changedPath, path));

  return api => {
    if (isDisabled(enabled, api.getState())) {
      return;
    }

    let hydrated = false;

    // Restore once a storage is resolvable. A dynamic `storage` can be unavailable at mount (a setting that picks or
    // gates it loads after the store), so `onChange` — which runs after each commit — retries until it can. Restoring
    // there is safe to do synchronously: nexus change-listeners are depth-counted, so the restore's own write nests
    // cleanly without needing to defer.
    const restore = (): void => {
      if (hydrated) {
        return;
      }

      const storage = storageFor(api.getState());
      if (!storage) {
        return;
      }

      hydrated = true;
      hydrate(api, key, storage, version, paths, migrate, merge);
    };

    return {
      // Runs after React mount (or synchronously standalone) to avoid SSR/client hydration mismatches.
      hydrate: restore,
      onChange: change => {
        restore();

        if (affectsPersisted(change.path)) {
          write(api);
        }
      }
    };
  };
};

function hydrate<TState extends object>(
  api: StoreApi<TState>,
  key: string,
  storage: PersistStorage | undefined,
  version: number,
  paths: PersistOptions<TState>['paths'],
  migrate: PersistOptions<TState>['migrate'],
  merge: PersistOptions<TState>['merge']
): void {
  const raw = storage?.getItem(key);
  if (!raw) {
    return;
  }

  try {
    const envelope = JSON.parse(raw) as Envelope;
    const persisted =
      envelope.version !== version && migrate ? migrate(envelope.state, envelope.version) : envelope.state;

    if (paths) {
      const fragment = persisted as Record<string, unknown>;
      api.batch(() => {
        for (const path of paths) {
          if (path in fragment) {
            api.setState(path, fragment[path] as never);
          }
        }
      });

      return;
    }

    // A full-state `setState` shallow-merges the partial at runtime; the type demands the whole shape, so cast.
    const next = persisted as Partial<TState>;
    api.setState(undefined, (merge ? merge(next, api.getState()) : next) as TState);
  } catch {
    storage?.removeItem(key);
  }
}
