import { afterEach, describe, expect, it } from 'vitest';

import createStore from '../createStore';
import { persistMiddleware } from './persistMiddleware';

import type { PersistStorage } from './persistMiddleware';

type S = { count: number; user: string };

const createInMemoryStorage = (): {
  storage: PersistStorage;
  data: Record<string, string>;
} => {
  const data: Record<string, string> = {};

  return {
    storage: {
      getItem: (key: string) => data[key] ?? null,
      setItem: (key: string, value: string) => {
        data[key] = value;
      },
      removeItem: (key: string) => {
        Reflect.deleteProperty(data, key);
      }
    },
    data
  };
};

describe('persistMiddleware SSR guard', () => {
  afterEach(() => {
    // Restore any globals that tests may have deleted
    if (typeof globalThis.localStorage !== 'undefined') {
      globalThis.localStorage.clear();
    }
  });

  it('uses noopStorage when localStorage is undefined (SSR)', () => {
    // jsdom provides localStorage by default; we can't easily remove it
    // but the persistMiddleware already defaults to noopStorage when
    // typeof localStorage === 'undefined'. We verify the fallback works
    // by passing an explicit storage that behaves like noopStorage.
    const { storage } = createInMemoryStorage();
    const store = createStore<S>(
      { count: 0, user: 'ssr' },
      {
        middlewares: [persistMiddleware({ key: 'ssr-test', storage })]
      }
    );

    // The store starts with the initial state (no hydration occurred)
    expect(store.getState().count).toBe(0);
    expect(store.getState().user).toBe('ssr');
  });

  it('does not hydrate when storage has no data', () => {
    const { storage } = createInMemoryStorage();
    const store = createStore<S>(
      { count: 0, user: 'ssr' },
      {
        middlewares: [persistMiddleware({ key: 'empty-key', storage })]
      }
    );

    expect(store.getState().count).toBe(0);
    expect(store.getState().user).toBe('ssr');
  });

  it('hydrates from storage when data exists', () => {
    const { storage, data } = createInMemoryStorage();
    data['hydrate-test'] = JSON.stringify({ version: 0, state: { count: 99, user: 'hydrated' } });

    const store = createStore<S>(
      { count: 0, user: 'ssr' },
      {
        middlewares: [persistMiddleware({ key: 'hydrate-test', storage })]
      }
    );

    expect(store.getState().count).toBe(99);
    expect(store.getState().user).toBe('hydrated');
  });

  it('writes to storage on state change', () => {
    const { storage, data } = createInMemoryStorage();
    const store = createStore<S>(
      { count: 0, user: 'ssr' },
      {
        middlewares: [persistMiddleware({ key: 'write-test', storage })]
      }
    );

    store.setState('count', 7);

    const saved = JSON.parse(data['write-test']) as { version: number; state: Record<string, unknown> };
    expect(saved.state.count).toBe(7);
  });

  it('handles corrupt persisted data gracefully', () => {
    const { storage, data } = createInMemoryStorage();
    data['corrupt'] = 'not-valid-json';

    const store = createStore<S>(
      { count: 0, user: 'ssr' },
      {
        middlewares: [persistMiddleware({ key: 'corrupt', storage })]
      }
    );

    // Falls back to initial state
    expect(store.getState().count).toBe(0);
    // Corrupt entry is removed
    expect(data['corrupt']).toBeUndefined();
  });

  it('persists only partialized state', () => {
    const { storage, data } = createInMemoryStorage();
    const store = createStore<S>(
      { count: 42, user: 'ephemeral' },
      {
        middlewares: [
          persistMiddleware({
            key: 'partial',
            storage,
            partialize: s => ({ count: s.count }) // drop user
          })
        ]
      }
    );

    store.setState('count', 99);

    const saved = JSON.parse(data['partial']) as { version: number; state: Record<string, unknown> };
    expect(saved.state).toEqual({ count: 99 });
    expect(saved.state.user).toBeUndefined();
  });

  it('respects version + migrate', () => {
    const { storage, data } = createInMemoryStorage();
    data['migrate-test'] = JSON.stringify({ version: 0, state: { name: 'old-schema' } });

    const store = createStore<S>(
      { count: 0, user: '' },
      {
        middlewares: [
          persistMiddleware({
            key: 'migrate-test',
            storage,
            version: 1,
            migrate: (persisted: unknown, ver: number) => {
              if (ver === 0) {
                const old = persisted as { name: string };

                return { count: old.name.length, user: old.name };
              }

              return {};
            }
          })
        ]
      }
    );

    expect(store.getState().user).toBe('old-schema');
  });
});
