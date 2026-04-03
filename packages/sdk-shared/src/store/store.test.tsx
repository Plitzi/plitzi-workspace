/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { renderHook, act } from '@testing-library/react';
import { createElement } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import createStore, { createStoreHook } from './createStore';
import getByPath from './helpers/getByPath';
import setByPath from './helpers/setByPath';
import useStore from './hooks/useStore';
import { StoreContext } from './StoreProvider';

import type { StoreApi, StoreApiInternal } from '../types';
import type { ReactNode } from 'react';

type State = {
  user: {
    name: string;
    age: number;
  };
  count: number;
};

describe('store', () => {
  const createTestStore = () =>
    createStore<State>((/* set, get */) => ({
      user: { name: 'Carlos', age: 30 },
      count: 0
    }));

  describe('getState', () => {
    it('should return initial state', () => {
      const store = createTestStore();
      const state = store.getState();

      expect(state.user.name).toBe('Carlos');
      expect(state.count).toBe(0);
    });
  });

  describe('setState (global)', () => {
    it('should update full state', () => {
      const store = createTestStore();

      store.setState(undefined, { user: { name: 'Ana', age: 25 }, count: 10 });

      const state = store.getState();

      expect(state.user.name).toBe('Ana');
      expect(state.count).toBe(10);
    });

    it('should support updater function', () => {
      const store = createTestStore();

      store.setState(undefined, prev => ({ ...prev, count: prev.count + 1 }));

      expect(store.getState().count).toBe(1);
    });
  });

  describe('setState (by path)', () => {
    it('should update nested value', () => {
      const store = createTestStore();

      store.setState('user.name', 'Pedro');

      expect(store.getState().user.name).toBe('Pedro');
    });

    it('should support updater function', () => {
      const store = createTestStore();

      store.setState('count', prev => prev + 5);

      expect(store.getState().count).toBe(5);
    });

    it('should not mutate previous state', () => {
      const store = createTestStore();
      const prev = store.getState();

      store.setState('user.name', 'Luis');

      expect(prev.user.name).toBe('Carlos'); // immutability
    });
  });

  describe('subscribe', () => {
    it('should notify listeners on change', () => {
      const store = createTestStore();
      const listener = vi.fn();

      store.subscribe(listener);

      store.setState(undefined, prev => ({ ...prev, count: 1 }));

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should not notify if state is equal', () => {
      const store = createTestStore();
      const listener = vi.fn();

      store.subscribe(listener);

      store.setState(undefined, prev => prev); // same reference

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('subscribePath', () => {
    it('should notify only when path changes', () => {
      const store = createTestStore();

      const userListener = vi.fn();
      const countListener = vi.fn();

      store.subscribePath('user.name', userListener);
      store.subscribePath('count', countListener);

      store.setState('user.name', 'Pedro');

      expect(userListener).toHaveBeenCalledTimes(1);
      expect(countListener).not.toHaveBeenCalled();
    });

    it('should not notify if path value is equal', () => {
      const store = createTestStore();
      const listener = vi.fn();

      store.subscribePath('count', listener);

      store.setState('count', 0); // same value

      expect(listener).not.toHaveBeenCalled();
    });
  });
});

describe('getByPath', () => {
  const obj = {
    a: {
      b: {
        c: 42
      }
    }
  };

  it('should get nested value', () => {
    expect(getByPath(obj, 'a.b.c')).toBe(42);
  });

  it('should return undefined if path does not exist', () => {
    // @ts-expect-error // eslint-disable-line
    expect(getByPath(obj, 'a.x.c')).toBeUndefined();
  });
});

describe('setByPath', () => {
  it('should set nested value', () => {
    const obj = { a: { b: 1 } };

    const result = setByPath(obj, 'a.b', 2);

    expect(result.a.b).toBe(2);
  });

  it('should create path if not exists', () => {
    const obj = {};

    const result = setByPath(obj, 'a.b.c', 10);

    // @ts-expect-error // eslint-disable-line
    expect(result.a.b.c).toBe(10);
  });

  it('should not mutate original object', () => {
    const obj = { a: { b: 1 } };

    const result = setByPath(obj, 'a.b', 2);

    expect(obj.a.b).toBe(1);
    expect(result.a.b).toBe(2);
  });

  it('should support array indexes', () => {
    const obj = { a: [1, 2, 3] };

    const result = setByPath(obj, 'a.1', 99);

    expect(result.a[1]).toBe(99);
  });
});

type State2 = {
  user: { name: string; age: number };
  items: string[];
  count: number;
};

describe('Advanced store tests', () => {
  let store: StoreApi<State2>;

  beforeEach(() => {
    store = createStore<State2>(() => ({
      user: { name: 'Alice', age: 30 },
      items: ['a', 'b'],
      count: 0
    }));
  });

  it('should correctly trigger path listeners only on changes', () => {
    const userListener = vi.fn();
    const countListener = vi.fn();

    store.subscribePath('user.name', userListener);
    store.subscribePath('count', countListener);

    // Update unrelated path
    // @ts-expect-error // eslint-disable-line
    store.setState(['items', 0], 'x');
    expect(userListener).not.toHaveBeenCalled();
    expect(countListener).not.toHaveBeenCalled();

    // Update user.name
    store.setState('user.name', 'Bob');
    expect(userListener).toHaveBeenCalledTimes(1);
    expect(countListener).not.toHaveBeenCalled();

    // Update count
    store.setState('count', 5);
    expect(countListener).toHaveBeenCalledTimes(1);
  });

  it('should not trigger listener if value is equal', () => {
    const listener = vi.fn();
    store.subscribePath('user.age', listener);

    // Same value
    store.setState('user.age', 30);
    expect(listener).not.toHaveBeenCalled();

    // Update value
    store.setState('user.age', 31);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should handle updater functions for path and full state', () => {
    // Full state updater
    store.setState(undefined, prev => ({ ...prev, count: prev.count + 1 }));
    expect(store.getState().count).toBe(1);

    // Path updater
    store.setState('count', prev => prev + 1);
    expect(store.getState().count).toBe(2);
  });

  it('should allow deep nested updates with arrays', () => {
    store.setState('items.1', 'z');
    expect(store.getState().items[1]).toBe('z');

    store.setState('items.0', prev => prev + '!');
    expect(store.getState().items[0]).toBe('a!');
  });

  it('should maintain immutability', () => {
    const prev = store.getState();
    store.setState('user.name', 'Charlie');

    const next = store.getState();
    expect(prev).not.toBe(next);
    expect(prev.user).not.toBe(next.user);
    expect(prev.items).toBe(next.items); // unchanged array reference
  });

  it('React: re-render only when relevant path changes', () => {
    const renderFn = vi.fn();

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <StoreContext value={store}>{children}</StoreContext>
    );

    renderHook(
      () => {
        const [name] = useStore<State2, 'user.name'>('user.name');
        renderFn();

        return name;
      },
      { wrapper }
    );

    expect(renderFn).toHaveBeenCalledTimes(1);

    // Unrelated update: no re-render
    act(() => store.setState('count', 10));
    expect(renderFn).toHaveBeenCalledTimes(1);

    // Relevant update: re-render
    act(() => store.setState('user.name', 'David'));
    expect(renderFn).toHaveBeenCalledTimes(2);
  });

  it('should throw if accessing non-existing path via getByPath', () => {
    // @ts-expect-error // eslint-disable-line
    expect(getByPath(store.getState(), 'user.nonexistent')).toBeUndefined();
  });

  it('should handle empty path gracefully', () => {
    expect(getByPath(store.getState(), '')).toEqual(store.getState());

    expect(getByPath(store.getState(), [])).toEqual(store.getState());
  });
});

// Performance

type PerfState = {
  count: number;
  user: { name: string; age: number };
  items: string[];
  nested: { a: { b: { c: number } } };
};

const initialState: PerfState = {
  count: 0,
  user: { name: 'Alice', age: 30 },
  items: Array.from({ length: 100 }, (_, i) => `item-${i}`),
  nested: { a: { b: { c: 42 } } }
};

const makeStore = () => createStore<PerfState>(() => ({ ...initialState, items: [...initialState.items] }));

const makeWrapper =
  (store: StoreApi<PerfState>) =>
  ({ children }: { children: ReactNode }) =>
    createElement(StoreContext, { value: store }, children);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const measure = (label: string, fn: () => void): number => {
  const start = performance.now();
  fn();
  const elapsed = performance.now() - start;
  console.log(`[perf] ${label}: ${elapsed.toFixed(2)}ms`);
  return elapsed;
};

// ─── 1. Re-renders innecesarios ───────────────────────────────────────────────

describe('Performance: re-renders innecesarios', () => {
  it('no re-renderiza cuando cambia un path no suscrito (1000 updates)', () => {
    const store = makeStore();
    const useStore = createStoreHook<PerfState>();
    const renderFn = vi.fn();

    const { result } = renderHook(
      () => {
        const [name] = useStore('user.name');
        renderFn();
        return name;
      },
      { wrapper: makeWrapper(store) }
    );

    expect(result.current).toBe('Alice');

    const elapsed = measure('1000 updates a path no suscrito', () => {
      for (let i = 0; i < 1000; i++) {
        act(() => store.setState('count', i));
      }
    });

    // Solo el render inicial
    expect(renderFn).toHaveBeenCalledTimes(1);
    expect(elapsed).toBeLessThan(500);
  });

  it('re-renderiza exactamente 1 vez por update relevante (1000 updates)', () => {
    const store = makeStore();
    const useStore = createStoreHook<PerfState>();
    const renderFn = vi.fn();

    renderHook(
      () => {
        const [count] = useStore('count');
        renderFn();
        return count;
      },
      { wrapper: makeWrapper(store) }
    );

    const elapsed = measure('1000 updates al path suscrito', () => {
      for (let i = 1; i <= 1000; i++) {
        act(() => store.setState('count', i));
      }
    });

    // 1 inicial + 1 por cada update
    expect(renderFn).toHaveBeenCalledTimes(1001);
    expect(elapsed).toBeLessThan(2000);
  });

  it('equalityFn evita re-renders con objetos equivalentes (selector)', () => {
    const store = makeStore();
    const useStore = createStoreHook<PerfState>();
    const renderFn = vi.fn();

    renderHook(
      () => {
        const [user] = useStore(
          s => s.user,
          (a, b) => a.name === b.name && a.age === b.age
        );
        renderFn();
        return user;
      },
      { wrapper: makeWrapper(store) }
    );

    const elapsed = measure('500 updates que no cambian user', () => {
      for (let i = 0; i < 500; i++) {
        act(() => store.setState('count', i));
      }
    });

    expect(renderFn).toHaveBeenCalledTimes(1);
    expect(elapsed).toBeLessThan(500);
  });

  it('1000 hooks suscritos al mismo path: solo re-renderizan cuando cambia', () => {
    const store = makeStore();
    const useStore = createStoreHook<PerfState>();
    const renderCounts: number[] = Array(1000).fill(0) as number[];

    const hooks = Array.from({ length: 1000 }, (_, i) =>
      renderHook(
        () => {
          const [name] = useStore('user.name');
          renderCounts[i]++;
          return name;
        },
        { wrapper: makeWrapper(store) }
      )
    );

    const initialRenders = renderCounts.reduce((a, b) => a + b, 0);
    expect(initialRenders).toBe(1000); // 1 render inicial cada uno

    const elapsed = measure('update user.name con 1000 hooks suscritos', () => {
      act(() => store.setState('user.name', 'Bob'));
    });

    const totalRenders = renderCounts.reduce((a, b) => a + b, 0);
    expect(totalRenders).toBe(2000); // 1 extra por cada hook
    expect(elapsed).toBeLessThan(1000);

    hooks.forEach(h => h.unmount());
  });
});

// ─── 2. Suscripción/unsuscripción masiva ──────────────────────────────────────

describe('Performance: suscripción y unsuscripción masiva', () => {
  it('suscribe y desuscribe 10.000 listeners en menos de 200ms', () => {
    const store = makeStore();
    const listeners = Array.from({ length: 10_000 }, () => vi.fn());
    const unsubs: Array<() => void> = [];

    const subElapsed = measure('suscribir 10.000 listeners', () => {
      listeners.forEach(l => unsubs.push(store.subscribe(l)));
    });

    const unsubElapsed = measure('desuscribir 10.000 listeners', () => {
      unsubs.forEach(u => u());
    });

    expect(subElapsed).toBeLessThan(200);
    expect(unsubElapsed).toBeLessThan(200);
  });

  it('suscribe y desuscribe 10.000 path listeners en menos de 200ms', () => {
    const store = makeStore();
    const unsubs: Array<() => void> = [];

    const subElapsed = measure('suscribir 10.000 path listeners', () => {
      for (let i = 0; i < 10_000; i++) {
        unsubs.push(store.subscribePath('count', vi.fn()));
      }
    });

    const unsubElapsed = measure('desuscribir 10.000 path listeners', () => {
      unsubs.forEach(u => u());
    });

    expect(subElapsed).toBeLessThan(200);
    expect(unsubElapsed).toBeLessThan(200);
  });

  it('notifica 10.000 listeners en menos de 100ms', () => {
    const store = makeStore();
    const listeners = Array.from({ length: 10_000 }, () => vi.fn());
    listeners.forEach(l => store.subscribe(l));

    const elapsed = measure('notificar 10.000 listeners', () => {
      store.setState(undefined, prev => ({ ...prev, count: 1 }));
    });

    listeners.forEach(l => expect(l).toHaveBeenCalledTimes(1));
    expect(elapsed).toBeLessThan(100);
  });

  it('hooks: mount y unmount de 500 componentes en menos de 2s', () => {
    const store = makeStore();
    const useStore = createStoreHook<PerfState>();

    const elapsed = measure('mount + unmount de 500 hooks', () => {
      const hooks = Array.from({ length: 500 }, () =>
        renderHook(() => useStore('count'), { wrapper: makeWrapper(store) })
      );
      hooks.forEach(h => h.unmount());
    });

    expect(elapsed).toBeLessThan(2000);
  });
});

// ─── 3. Memoria con miles de listeners ───────────────────────────────────────

describe('Performance: memoria con miles de listeners', () => {
  it('no acumula listeners: subscribe → unsub limpia correctamente', () => {
    const store = makeStore() as StoreApiInternal<PerfState>;
    const unsubs: Array<() => void> = [];

    for (let i = 0; i < 1000; i++) {
      unsubs.push(store.subscribe(vi.fn()));
    }

    expect(store.listeners.size).toBe(1000);

    unsubs.forEach(u => u());

    expect(store.listeners.size).toBe(0);
  });

  it('no acumula path listeners: subscribePath → unsub limpia correctamente', () => {
    const store = makeStore() as StoreApiInternal<PerfState>;
    const unsubs: Array<() => void> = [];

    for (let i = 0; i < 1000; i++) {
      unsubs.push(store.subscribePath('user.name', vi.fn()));
    }

    expect(store.pathListeners.get('user.name')?.size).toBe(1000);

    unsubs.forEach(u => u());

    expect(store.pathListeners.get('user.name')?.size).toBe(0);
  });

  it('setState masivo no genera entradas en pathListeners', () => {
    const store = makeStore() as StoreApiInternal<PerfState>;

    measure('10.000 setState por path sin suscriptores', () => {
      for (let i = 0; i < 10_000; i++) {
        store.setState('count', i);
      }
    });

    expect(store.pathListeners.size).toBe(0);
  });

  it('múltiples paths suscritos y liberados no dejan Sets con listeners', () => {
    const store = makeStore() as StoreApiInternal<PerfState>;
    const paths = ['count', 'user.name', 'user.age', 'nested.a.b.c'] as const;
    const unsubs: Array<() => void> = [];

    paths.forEach(p => {
      for (let i = 0; i < 250; i++) {
        unsubs.push(store.subscribePath(p, vi.fn()));
      }
    });

    expect(store.pathListeners.size).toBe(4);

    unsubs.forEach(u => u());

    store.pathListeners.forEach(set => {
      expect(set.size).toBe(0);
    });
  });

  it('hooks: no re-renderiza paths no suscritos tras unmount masivo', () => {
    const store = makeStore();
    const useStore = createStoreHook<PerfState>();
    const renderFn = vi.fn();

    // Montamos y desmontamos 200 hooks para asegurarnos que no queden suscripciones colgadas
    const tempHooks = Array.from({ length: 200 }, () =>
      renderHook(() => useStore('user.name'), { wrapper: makeWrapper(store) })
    );
    tempHooks.forEach(h => h.unmount());

    // Este hook se monta después — si hubiera leaks recibiría notificaciones fantasma
    const { result } = renderHook(
      () => {
        const [count] = useStore('count');
        renderFn();
        return count;
      },
      { wrapper: makeWrapper(store) }
    );

    expect(result.current).toBe(0);

    act(() => store.setState('user.name', 'Ghost'));

    // Solo el render inicial — ninguna suscripción fantasma disparó re-renders
    expect(renderFn).toHaveBeenCalledTimes(1);
  });
});

// ─── 4. Stress test combinado ─────────────────────────────────────────────────

describe('Performance: stress test combinado', () => {
  it('500 hooks × 100 updates × paths mixtos en menos de 5s', () => {
    const store = makeStore();
    const useStore = createStoreHook<PerfState>();
    const paths = ['count', 'user.name', 'user.age'] as const;

    const hooks = Array.from({ length: 500 }, (_, i) =>
      renderHook(() => useStore(paths[i % paths.length]), { wrapper: makeWrapper(store) })
    );

    const elapsed = measure('500 hooks × 100 updates', () => {
      for (let i = 0; i < 100; i++) {
        act(() => {
          store.setState('count', i);
          store.setState('user.name', `user-${i}`);
          store.setState('user.age', 20 + (i % 50));
        });
      }
    });

    hooks.forEach(h => h.unmount());

    expect(elapsed).toBeLessThan(5000);
  });
});
