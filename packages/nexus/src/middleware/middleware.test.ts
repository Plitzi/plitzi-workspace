import { afterEach, describe, it, expect } from 'vitest';

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
});

describe('enabled control', () => {
  it('skips a middleware entirely when enabled is false (no observers, no hydrate)', () => {
    const { storage, data } = memoryStorage();
    data.set('app', JSON.stringify({ version: 0, state: { count: 9, ui: { open: false } } }));
    const changes: StoreChange<AppState>[] = [];
    const store = createStore<AppState>(initial(), {
      middlewares: [
        persistMiddleware({ key: 'app', storage, enabled: false }),
        loggerMiddleware({ sink: c => changes.push(c), enabled: false })
      ]
    });

    expect(store.getState().count).toBe(0); // never hydrated
    store.setState('count', 1);

    expect(changes).toEqual([]); // logger never observed
    expect(readStored(data, 'app').state.count).toBe(9); // persist never wrote
  });

  it('resolves a predicate against initial state at setup', () => {
    const off: StoreChange<AppState>[] = [];
    const offStore = createStore<AppState>(initial(), {
      middlewares: [loggerMiddleware({ sink: c => off.push(c), enabled: s => s.ui.open })]
    });

    offStore.setState('count', 1);
    offStore.setState('ui.open', true);
    expect(off).toHaveLength(0); // predicate was false at setup → middleware never registered

    const on: StoreChange<AppState>[] = [];
    const onStore = createStore<AppState>(
      { count: 0, ui: { open: true } },
      { middlewares: [loggerMiddleware({ sink: c => on.push(c), enabled: s => s.ui.open })] }
    );

    onStore.setState('count', 1);
    expect(on.map(c => c.path)).toEqual(['count']);
  });
});

describe('persist storage targets', () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('defaults to localStorage and supports sessionStorage', () => {
    createStore<AppState>(initial(), { middlewares: [persistMiddleware({ key: 'local-app' })] }).setState('count', 1);
    createStore<AppState>(initial(), {
      middlewares: [persistMiddleware({ key: 'session-app', storage: 'session' })]
    }).setState('count', 2);

    const parse = (raw: string | null) => JSON.parse(raw ?? 'null') as StoredEnvelope;
    expect(parse(localStorage.getItem('local-app')).state.count).toBe(1);
    expect(sessionStorage.getItem('local-app')).toBeNull();
    expect(parse(sessionStorage.getItem('session-app')).state.count).toBe(2);
  });

  it('resolves the target from state when storage is a function', () => {
    type Toggled = AppState & { useSession: boolean };
    const store = createStore<Toggled>(
      { ...initial(), useSession: false },
      { middlewares: [persistMiddleware<Toggled>({ key: 'dyn', storage: s => (s.useSession ? 'session' : 'local') })] }
    );

    store.setState('count', 1);
    expect(localStorage.getItem('dyn')).not.toBeNull();
    expect(sessionStorage.getItem('dyn')).toBeNull();

    store.setState('useSession', true);
    store.setState('count', 2);
    expect(sessionStorage.getItem('dyn')).not.toBeNull();
  });

  it('skips the write when the resolver returns false', () => {
    type Gated = AppState & { persistOn: boolean };
    const store = createStore<Gated>(
      { ...initial(), persistOn: false },
      { middlewares: [persistMiddleware<Gated>({ key: 'gated', storage: s => (s.persistOn ? 'local' : false) })] }
    );

    store.setState('count', 1);
    expect(localStorage.getItem('gated')).toBeNull();

    store.setState('persistOn', true);
    store.setState('count', 2);
    expect(localStorage.getItem('gated')).not.toBeNull();
  });

  it('skips persistence when the chosen storage is unavailable', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      }
    });

    try {
      const changes: StoreChange<AppState>[] = [];
      const store = createStore<AppState>(initial(), {
        middlewares: [persistMiddleware({ key: 'app' }), loggerMiddleware({ sink: c => changes.push(c) })]
      });

      expect(() => store.setState('count', 1)).not.toThrow();
      expect(changes.map(c => c.path)).toEqual(['count']); // store still works, only persist skipped
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'localStorage', descriptor);
      }
    }
  });

  it('is a safe no-op in SSR (no Web Storage)', () => {
    const localDesc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const sessionDesc = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
    // Simulate a server environment: no Web Storage at all.
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: undefined });
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: undefined });

    try {
      const changes: StoreChange<AppState>[] = [];
      // Static target: the middleware skips itself entirely.
      const staticStore = createStore<AppState>(initial(), {
        middlewares: [persistMiddleware({ key: 'a' }), loggerMiddleware({ sink: c => changes.push(c) })]
      });
      staticStore.hydrate?.();
      expect(() => staticStore.setState('count', 1)).not.toThrow();

      // Dynamic target: registers, but hydrate and writes no-op because the storage never resolves.
      const dynamicStore = createStore<AppState>(initial(), {
        middlewares: [persistMiddleware<AppState>({ key: 'b', paths: ['count'], storage: () => 'local' })]
      });
      dynamicStore.hydrate?.();
      expect(() => dynamicStore.setState('count', 2)).not.toThrow();

      expect(changes.map(c => c.path)).toEqual(['count']); // store still works
    } finally {
      if (localDesc) {
        Object.defineProperty(globalThis, 'localStorage', localDesc);
      }

      if (sessionDesc) {
        Object.defineProperty(globalThis, 'sessionStorage', sessionDesc);
      }
    }
  });
});

describe('persist path fragments', () => {
  it('persists and rehydrates only the selected paths', () => {
    const { storage, data } = memoryStorage();
    const store = createStore<AppState>(initial(), {
      middlewares: [persistMiddleware<AppState>({ key: 'app', storage, paths: ['count'] })]
    });

    store.setState('count', 6);
    store.setState('ui.open', true);

    expect(readStored(data, 'app').state).toEqual({ count: 6 });

    const restored = createStore<AppState>(initial(), {
      middlewares: [persistMiddleware<AppState>({ key: 'app', storage, paths: ['count'] })]
    });

    expect(restored.getState()).toEqual({ count: 6, ui: { open: false } }); // ui left at its initial value
  });

  it('hydrates once a late-arriving storage resolver becomes available', async () => {
    const { storage, data } = memoryStorage();
    data.set('app', JSON.stringify({ version: 0, state: { count: 8 } }));
    type Gated = AppState & { ready: boolean };
    const store = createStore<Gated>(
      { ...initial(), ready: false },
      {
        middlewares: [
          persistMiddleware<Gated>({ key: 'app', paths: ['count'], storage: s => (s.ready ? storage : false) })
        ]
      }
    );

    expect(store.getState().count).toBe(0); // storage gated off at mount → not hydrated

    store.setState('ready', true);
    await Promise.resolve(); // flush the deferred restore

    expect(store.getState().count).toBe(8);
  });

  it('does not write on changes outside the persisted paths', () => {
    const { storage, data } = memoryStorage();
    const store = createStore<AppState>(initial(), {
      middlewares: [persistMiddleware<AppState>({ key: 'app', storage, paths: ['count'] })]
    });

    store.setState('count', 5);
    const afterCount = data.get('app');

    store.setState('ui.open', true); // unrelated subtree must not trigger a write
    expect(data.get('app')).toBe(afterCount);
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
