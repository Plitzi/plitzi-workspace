import type { StoreApi, StoreMiddleware } from '../types';

export type PersistStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export type PersistOptions<TState extends object> = {
  key: string;
  // Where to read/write. Defaults to `localStorage`, or a no-op when it isn't available (SSR).
  storage?: PersistStorage;
  // Persist only part of the state (e.g. drop ephemeral UI flags).
  partialize?: (state: TState) => Partial<TState>;
  // Bump when the persisted shape changes; `migrate` turns an older payload into the current shape.
  version?: number;
  migrate?: (persisted: unknown, version: number) => Partial<TState>;
  // How to fold the persisted value into the freshly created state. Defaults to a shallow overlay.
  merge?: (persisted: Partial<TState>, current: TState) => Partial<TState>;
  // Coalesce rapid writes; 0 (default) writes synchronously on every change.
  debounce?: number;
};

const noopStorage: PersistStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};

const defaultStorage = (): PersistStorage => (typeof localStorage !== 'undefined' ? localStorage : noopStorage);

type Envelope = { version: number; state: unknown };

// Mirrors the store to a key/value storage and rehydrates from it on creation. Put it first in the `middlewares`
// array so it hydrates before logger/history observe anything.
export const persistMiddleware = <TState extends object>(options: PersistOptions<TState>): StoreMiddleware<TState> => {
  const { key, storage = defaultStorage(), partialize, version = 0, migrate, merge, debounce = 0 } = options;

  const write = (api: StoreApi<TState>): void => {
    const state = api.getState();
    const payload: Envelope = { version, state: partialize ? partialize(state) : state };
    storage.setItem(key, JSON.stringify(payload));
  };

  return api => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    return {
      // Hydration runs after React mount (or synchronously in standalone usage)
      // to prevent hydration mismatches between SSR and client.
      hydrate: store => {
        hydrate(store, key, storage, version, migrate, merge);
      },
      onChange: () => {
        if (debounce <= 0) {
          write(api);

          return;
        }

        clearTimeout(timer);
        timer = setTimeout(() => write(api), debounce);
      }
    };
  };
};

function hydrate<TState extends object>(
  api: StoreApi<TState>,
  key: string,
  storage: PersistStorage,
  version: number,
  migrate: PersistOptions<TState>['migrate'],
  merge: PersistOptions<TState>['merge']
): void {
  const raw = storage.getItem(key);
  if (!raw) {
    return;
  }

  try {
    const envelope = JSON.parse(raw) as Envelope;
    const persisted =
      envelope.version !== version && migrate
        ? migrate(envelope.state, envelope.version)
        : (envelope.state as Partial<TState>);

    // A full-state `setState` shallow-merges a partial over the current state at runtime; the type just demands the
    // whole shape, so cast.
    api.setState(undefined, (merge ? merge(persisted, api.getState()) : persisted) as TState);
  } catch {
    // Corrupt or incompatible payload: drop it and keep the initial state.
    storage.removeItem(key);
  }
}
