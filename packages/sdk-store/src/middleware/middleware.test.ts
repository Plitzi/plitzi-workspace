import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { loggerMiddleware } from './loggerMiddleware';
import { persistMiddleware } from './persistMiddleware';
import createStore from '../createStore/createStore';

import type { PersistStorage } from './persistMiddleware';
import type { StoreChange } from '../types';

const memoryStorage = () => {
  const data = new Map<string, string>();
  const storage: PersistStorage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: key => void data.delete(key)
  };

  return { storage, data };
};

type StoredEnvelope = { version: number; state: { count?: number; ui?: { open: boolean } } };
const readStored = (data: Map<string, string>, key: string): StoredEnvelope =>
  JSON.parse(data.get(key) ?? 'null') as StoredEnvelope;

type AppState = { count: number; ui: { open: boolean } };
const initial = (): AppState => ({ count: 0, ui: { open: false } });

describe('logger middleware', () => {
  it('reports each committed change with prev/next snapshots', () => {
    const changes: StoreChange<AppState>[] = [];
    const store = createStore<AppState>(initial(), { middlewares: [loggerMiddleware({ sink: c => changes.push(c) })] });

    store.setState('count', 1);

    expect(changes).toEqual([
      { path: 'count', prev: { count: 0, ui: { open: false } }, next: { count: 1, ui: { open: false } } }
    ]);
  });

  it('honours a filter', () => {
    const changes: StoreChange<AppState>[] = [];
    const store = createStore<AppState>(initial(), {
      middlewares: [loggerMiddleware({ filter: c => c.path === 'count', sink: c => changes.push(c) })]
    });

    store.setState('ui.open', true);
    store.setState('count', 5);

    expect(changes.map(c => c.path)).toEqual(['count']);
  });

  it('accepts a bare sink function', () => {
    const changes: StoreChange<AppState>[] = [];
    const store = createStore<AppState>(initial(), { middlewares: [loggerMiddleware(c => changes.push(c))] });

    store.setState('count', 1);

    expect(changes).toHaveLength(1);
  });
});

describe('persist middleware', () => {
  it('writes committed state to storage', () => {
    const { storage, data } = memoryStorage();
    const store = createStore<AppState>(initial(), { middlewares: [persistMiddleware({ key: 'app', storage })] });

    store.setState('count', 7);

    expect(readStored(data, 'app')).toEqual({ version: 0, state: { count: 7, ui: { open: false } } });
  });

  it('rehydrates a new store from storage', () => {
    const { storage } = memoryStorage();
    createStore<AppState>(initial(), { middlewares: [persistMiddleware({ key: 'app', storage })] }).setState(
      'count',
      9
    );

    const restored = createStore<AppState>(initial(), { middlewares: [persistMiddleware({ key: 'app', storage })] });

    expect(restored.getState().count).toBe(9);
  });

  it('persists only the partialized slice', () => {
    const { storage, data } = memoryStorage();
    const store = createStore<AppState>(initial(), {
      middlewares: [persistMiddleware({ key: 'app', storage, partialize: s => ({ count: s.count }) })]
    });

    store.setState('ui.open', true);

    expect(readStored(data, 'app').state).toEqual({ count: 0 });
  });

  it('migrates a payload from an older version', () => {
    const { storage, data } = memoryStorage();
    data.set('app', JSON.stringify({ version: 0, state: { counter: 3 } }));

    const store = createStore<AppState>(initial(), {
      middlewares: [
        persistMiddleware<AppState>({
          key: 'app',
          storage,
          version: 1,
          migrate: old => ({ count: (old as { counter: number }).counter })
        })
      ]
    });

    expect(store.getState().count).toBe(3);
  });

  it('drops a corrupt payload instead of throwing', () => {
    const { storage, data } = memoryStorage();
    data.set('app', '{not json');

    const store = createStore<AppState>(initial(), { middlewares: [persistMiddleware({ key: 'app', storage })] });

    expect(store.getState().count).toBe(0);
    expect(data.has('app')).toBe(false);
  });

  describe('with debounce', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('coalesces rapid writes into a single storage write', () => {
      const { storage, data } = memoryStorage();
      const spy = vi.spyOn(storage, 'setItem');
      const store = createStore<AppState>(initial(), {
        middlewares: [persistMiddleware({ key: 'app', storage, debounce: 50 })]
      });

      store.setState('count', 1);
      store.setState('count', 2);
      store.setState('count', 3);
      expect(spy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(readStored(data, 'app').state.count).toBe(3);
    });
  });
});

describe('middleware ordering', () => {
  it('a persist placed first hydrates before later middlewares observe', () => {
    const { storage } = memoryStorage();
    createStore<AppState>(initial(), { middlewares: [persistMiddleware({ key: 'app', storage })] }).setState(
      'count',
      4
    );

    const seen: (number | undefined)[] = [];
    const store = createStore<AppState>(initial(), {
      middlewares: [
        persistMiddleware({ key: 'app', storage }),
        loggerMiddleware({ sink: c => seen.push(c.next.count) })
      ]
    });

    expect(store.getState().count).toBe(4); // hydrated
    expect(seen).toEqual([]); // logger never saw the hydration write

    store.setState('count', 5);
    expect(seen).toEqual([5]);
  });
});
