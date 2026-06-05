import { afterEach, describe, it, expect, vi } from 'vitest';

import { logger } from './logger';
import { persist } from './persist';
import createStore from '../createStore/createStore';

import type { PersistStorage } from './persist';

type State = { count: number; ui: { open: boolean } };
const initial = (): State => ({ count: 0, ui: { open: false } });

const memoryStorage = () => {
  const data = new Map<string, string>();
  let writes = 0;
  const storage: PersistStorage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => {
      writes++;
      data.set(key, value);
    },
    removeItem: key => void data.delete(key)
  };

  return { storage, data, writes: () => writes };
};

const seed = (data: Map<string, string>, key: string, envelope: unknown) => data.set(key, JSON.stringify(envelope));

afterEach(() => vi.useRealTimers());

describe('persist middleware — edge cases', () => {
  it('drops a corrupt payload and keeps the initial state', () => {
    const { storage, data } = memoryStorage();
    data.set('app', '{ not valid json');
    const store = createStore<State>(initial(), { middlewares: [persist<State>({ key: 'app', storage })] });

    expect(store.getState()).toEqual(initial());
    expect(data.has('app')).toBe(false);
  });

  it('runs migrate when the persisted version differs', () => {
    const { storage, data } = memoryStorage();
    seed(data, 'app', { version: 0, state: { count: 1 } });

    const store = createStore<State>(initial(), {
      middlewares: [
        persist<State>({
          key: 'app',
          storage,
          version: 1,
          migrate: persisted => ({ count: (persisted as { count: number }).count + 100 })
        })
      ]
    });

    expect(store.getState().count).toBe(101);
  });

  it('uses the stored payload as-is on a version mismatch without migrate', () => {
    const { storage, data } = memoryStorage();
    seed(data, 'app', { version: 5, state: { count: 7 } });

    const store = createStore<State>(initial(), { middlewares: [persist<State>({ key: 'app', storage, version: 1 })] });

    expect(store.getState().count).toBe(7);
  });

  it('persists only the partialized slice', () => {
    const { storage, data } = memoryStorage();
    const store = createStore<State>(initial(), {
      middlewares: [persist<State>({ key: 'app', storage, partialize: state => ({ count: state.count }) })]
    });

    store.setState('count', 3);

    const saved = JSON.parse(data.get('app') ?? 'null') as { state: Partial<State> };
    expect(saved.state).toEqual({ count: 3 });
  });

  it('folds the persisted value through a custom merge on hydrate', () => {
    const { storage, data } = memoryStorage();
    seed(data, 'app', { version: 0, state: { count: 9 } });

    const store = createStore<State>(initial(), {
      middlewares: [
        persist<State>({
          key: 'app',
          storage,
          merge: (persisted, current) => ({ count: (persisted.count ?? 0) + current.count })
        })
      ]
    });

    expect(store.getState().count).toBe(9);
  });

  it('coalesces rapid writes when debounced', () => {
    vi.useFakeTimers();
    const { storage, data, writes } = memoryStorage();
    const store = createStore<State>(initial(), {
      middlewares: [persist<State>({ key: 'app', storage, debounce: 50 })]
    });

    store.setState('count', 1);
    store.setState('count', 2);
    store.setState('count', 3);
    expect(writes()).toBe(0);

    vi.advanceTimersByTime(50);

    expect(writes()).toBe(1);
    const saved = JSON.parse(data.get('app') ?? 'null') as { state: State };
    expect(saved.state.count).toBe(3);
  });
});

describe('logger middleware — edge cases', () => {
  it('logs to console.log by default', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const store = createStore<State>(initial(), { middlewares: [logger<State>()] });

    store.setState('count', 1);

    expect(spy).toHaveBeenCalledWith('[store]', 'count', expect.anything());
    spy.mockRestore();
  });

  it('skips changes filtered out', () => {
    const sink = vi.fn();
    const store = createStore<State>(initial(), {
      middlewares: [logger<State>({ filter: change => change.path !== 'count', sink })]
    });

    store.setState('count', 1);
    expect(sink).not.toHaveBeenCalled();

    store.setState('ui.open', true);
    expect(sink).toHaveBeenCalledTimes(1);
  });
});
