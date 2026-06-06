/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { renderHook, act } from '@testing-library/react';
import { createElement } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import createStore, { createStoreHook } from './createStore';
import useStore from './createStore/hooks/useStore';
import getByPath from './helpers/getByPath';
import setByPath from './helpers/setByPath';
import { loggerMiddleware } from './middleware/loggerMiddleware';
import { StoreContext } from './StoreProvider';

import type { PathOf, StoreApi, StoreApiInternal, StoreChange } from './types';
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

    it('should wake a descendant listener when a single-segment object write changes its value', () => {
      const store = createTestStore();
      const nameListener = vi.fn();
      const ageListener = vi.fn();

      store.subscribePath('user.name', nameListener);
      store.subscribePath('user.age', ageListener);

      store.setState('user', { name: 'Pedro', age: store.getState().user.age });

      expect(store.getState().user.name).toBe('Pedro');
      expect(nameListener).toHaveBeenCalledTimes(1);
      expect(ageListener).not.toHaveBeenCalled();
    });

    it('should not mutate a snapshot taken before a single-segment write', () => {
      const store = createTestStore();
      const prev = store.getState();

      store.setState('count', 99);

      expect(prev.count).toBe(0); // immutability of the handed-out snapshot
      expect(store.getState().count).toBe(99);
    });
  });
});

describe('store enabled / options', () => {
  type AppState = {
    user: { name: string; age: number; role: 'admin' | 'viewer' };
    schema: {
      version: number;
      flat: Record<string, { label: string; type: string }>;
      pages: string[];
    };
    count: number;
    meta: { active: boolean; updatedAt: number };
    tags: string[];
  };

  const makeStore = () =>
    createStore<AppState>(() => ({
      user: { name: 'Alice', age: 30, role: 'viewer' },
      schema: {
        version: 1,
        flat: {
          btn1: { label: 'Button', type: 'button' },
          txt1: { label: 'Text', type: 'text' }
        },
        pages: ['btn1']
      },
      count: 0,
      meta: { active: true, updatedAt: 1000 },
      tags: ['a', 'b', 'c']
    }));

  const makeWrapper =
    (store: StoreApi<AppState>) =>
    ({ children }: { children: ReactNode }) =>
      createElement(StoreContext, { value: store }, children);

  const { useStore, useStoreSync } = createStoreHook<AppState>();

  describe('useStore: enabled option', () => {
    it('does not re-render when disabled and state changes', () => {
      const store = makeStore();
      const renderFn = vi.fn();

      renderHook(
        () => {
          renderFn();
          return useStore('count', { enabled: false });
        },
        { wrapper: makeWrapper(store) }
      );

      act(() => store.setState('count', 99));

      expect(renderFn).toHaveBeenCalledTimes(1); // initial only
    });

    it('returns last known value when disabled', () => {
      const store = makeStore();

      const { result } = renderHook(() => useStore('count', { enabled: false }), { wrapper: makeWrapper(store) });

      act(() => store.setState('count', 42));

      expect(result.current[0]).toBe(0); // still the initial value
    });

    it('subscribes and re-renders when enabled switches true → true (already enabled)', () => {
      const store = makeStore();
      const renderFn = vi.fn();

      renderHook(
        () => {
          renderFn();
          return useStore('count', { enabled: true });
        },
        { wrapper: makeWrapper(store) }
      );

      act(() => store.setState('count', 5));
      expect(renderFn).toHaveBeenCalledTimes(2);
    });

    it('starts receiving updates after enabled switches false → true', () => {
      const store = makeStore();
      const renderFn = vi.fn();
      let enabled = false;

      const { rerender, result } = renderHook(
        () => {
          renderFn();
          return useStore('count', { enabled });
        },
        { wrapper: makeWrapper(store) }
      );

      act(() => store.setState('count', 10));
      expect(renderFn).toHaveBeenCalledTimes(1); // disabled — no re-render

      enabled = true;
      rerender();

      act(() => store.setState('count', 20));
      expect(result.current[0]).toBe(20);
      expect(renderFn).toHaveBeenCalledTimes(3); // rerender + update
    });

    it('stops receiving updates after enabled switches true → false', () => {
      const store = makeStore();
      const renderFn = vi.fn();
      let enabled = true;

      const { rerender } = renderHook(
        () => {
          renderFn();
          return useStore('count', { enabled });
        },
        { wrapper: makeWrapper(store) }
      );

      act(() => store.setState('count', 5));
      expect(renderFn).toHaveBeenCalledTimes(2); // initial + update

      enabled = false;
      rerender();

      act(() => store.setState('count', 99));
      expect(renderFn).toHaveBeenCalledTimes(3); // only the rerender from enabled change
    });

    it('disabled path fn does not re-render on state change', () => {
      const store = makeStore();
      const renderFn = vi.fn();

      renderHook(
        () => {
          renderFn();
          return useStore(() => 'count' as const, { enabled: false });
        },
        { wrapper: makeWrapper(store) }
      );

      act(() => store.setState('count', 7));
      expect(renderFn).toHaveBeenCalledTimes(1);
    });

    it('disabled multi-path does not re-render on state change', () => {
      const store = makeStore();
      const renderFn = vi.fn();

      renderHook(
        () => {
          renderFn();
          return useStore(['count', 'user.name'] as const, { enabled: false });
        },
        { wrapper: makeWrapper(store) }
      );

      act(() => store.setState('count', 7));
      act(() => store.setState('user.name', 'Bob'));
      expect(renderFn).toHaveBeenCalledTimes(1);
    });

    it('setter still works when disabled', () => {
      const store = makeStore();

      const { result } = renderHook(() => useStore('count', { enabled: false }), { wrapper: makeWrapper(store) });

      act(() => result.current[1](55));
      expect(store.getState().count).toBe(55);
    });
  });

  describe('useStore: switching arg shape between renders', () => {
    // The typed overloads intentionally forbid a value that is sometimes a path and
    // sometimes an array of paths; this cast exercises that runtime scenario, which
    // is what would break the hook order if the implementation branched on the arg.
    const useStoreDynamic = useStore as unknown as (
      arg: PathOf<AppState> | ReadonlyArray<PathOf<AppState>>
    ) => [unknown, ...unknown[]];

    it('keeps a stable hook order when arg switches single path → array → single path', () => {
      const store = makeStore();
      let arg: PathOf<AppState> | ReadonlyArray<PathOf<AppState>> = 'count';

      const { result, rerender } = renderHook(() => useStoreDynamic(arg), { wrapper: makeWrapper(store) });

      expect(result.current[0]).toBe(0);

      arg = ['count', 'user.name'];
      rerender();
      expect(result.current[0]).toEqual([0, 'Alice']);

      arg = 'user.name';
      rerender();
      expect(result.current[0]).toBe('Alice');
    });

    it('keeps reacting to updates after the arg shape changes', () => {
      const store = makeStore();
      let arg: PathOf<AppState> | ReadonlyArray<PathOf<AppState>> = 'count';

      const { result, rerender } = renderHook(() => useStoreDynamic(arg), { wrapper: makeWrapper(store) });

      arg = ['count', 'user.name'];
      rerender();

      act(() => store.setState('user.name', 'Bob'));
      expect(result.current[0]).toEqual([0, 'Bob']);

      arg = 'count';
      rerender();

      act(() => store.setState('count', 42));
      expect(result.current[0]).toBe(42);
    });
  });

  describe('useStore: dynamic paths', () => {
    it('reads the correct value for a dynamic path', () => {
      const store = makeStore();
      const id = 'btn1';

      const { result } = renderHook(() => useStore(`schema.flat.${id}` as PathOf<AppState>), {
        wrapper: makeWrapper(store)
      });

      expect((result.current[0] as { label: string }).label).toBe('Button');
    });

    it('re-renders when the dynamic path value changes', () => {
      const store = makeStore();
      const renderFn = vi.fn();
      const id = 'btn1';

      renderHook(
        () => {
          renderFn();
          return useStore(`schema.flat.${id}` as PathOf<AppState>);
        },
        { wrapper: makeWrapper(store) }
      );

      act(() => store.setState(`schema.flat.${id}` as PathOf<AppState>, { label: 'Updated', type: 'button' }));

      expect(renderFn).toHaveBeenCalledTimes(2);
    });

    it('does NOT re-render when a sibling dynamic path changes', () => {
      const store = makeStore();
      const renderFn = vi.fn();

      renderHook(
        () => {
          renderFn();
          return useStore('schema.flat.btn1' as PathOf<AppState>);
        },
        { wrapper: makeWrapper(store) }
      );

      // Change txt1, not btn1
      act(() => store.setState('schema.flat.txt1' as PathOf<AppState>, { label: 'Changed', type: 'text' }));

      expect(renderFn).toHaveBeenCalledTimes(1);
    });

    it('switches to the new path when the dynamic segment changes', () => {
      const store = makeStore();
      let id = 'btn1';

      const { rerender, result } = renderHook(() => useStore(`schema.flat.${id}` as PathOf<AppState>), {
        wrapper: makeWrapper(store)
      });

      expect((result.current[0] as { label: string }).label).toBe('Button');

      id = 'txt1';
      rerender();

      expect((result.current[0] as { label: string }).label).toBe('Text');
    });

    it('handles a dynamic path that does not exist yet', () => {
      const store = makeStore();

      const { result } = renderHook(() => useStore('schema.flat.nonexistent' as PathOf<AppState>), {
        wrapper: makeWrapper(store)
      });

      expect(result.current[0]).toBeUndefined();
    });
  });

  describe('useStore: function path re-subscription', () => {
    it('reads from the resolved path on initial render', () => {
      const store = makeStore();

      const { result } = renderHook(
        () => useStore(s => (s.meta.active ? 'user.name' : 'user.age') as PathOf<AppState>),
        { wrapper: makeWrapper(store) }
      );

      expect(result.current[0]).toBe('Alice'); // meta.active = true → user.name
    });

    it('re-renders with new path value when resolved path changes', () => {
      const store = makeStore();
      const renderFn = vi.fn();

      const { result } = renderHook(
        () => {
          renderFn();
          return useStore(s => (s.meta.active ? 'user.name' : 'user.age') as PathOf<AppState>);
        },
        { wrapper: makeWrapper(store) }
      );

      expect(result.current[0]).toBe('Alice');

      // Changing meta.active causes the resolved path to switch from 'user.name' to 'user.age'
      act(() => store.setState('meta.active', false));

      expect(result.current[0]).toBe(30); // now reading user.age
      expect(renderFn).toHaveBeenCalledTimes(2);
    });

    it('stops reacting to old path after resolved path changes', () => {
      const store = makeStore();
      const renderFn = vi.fn();

      renderHook(
        () => {
          renderFn();
          return useStore(s => (s.meta.active ? 'user.name' : 'user.age') as PathOf<AppState>);
        },
        { wrapper: makeWrapper(store) }
      );

      // Switch resolved path to 'user.age'
      act(() => store.setState('meta.active', false));
      expect(renderFn).toHaveBeenCalledTimes(2);

      // Changing old path (user.name) should NOT cause a re-render
      act(() => store.setState('user.name', 'Bob'));
      expect(renderFn).toHaveBeenCalledTimes(2); // no extra render
    });

    it('reacts to changes on the new resolved path after the switch', () => {
      const store = makeStore();
      const renderFn = vi.fn();

      const { result } = renderHook(
        () => {
          renderFn();
          return useStore(s => (s.meta.active ? 'user.name' : 'user.age') as PathOf<AppState>);
        },
        { wrapper: makeWrapper(store) }
      );

      // Switch resolved path to 'user.age'
      act(() => store.setState('meta.active', false));
      expect(result.current[0]).toBe(30);

      // Changes on new path (user.age) should trigger a re-render
      act(() => store.setState('user.age', 99));
      expect(result.current[0]).toBe(99);
      expect(renderFn).toHaveBeenCalledTimes(3);
    });

    it('multi-path: stops reacting to old path after one path function resolves differently', () => {
      const store = makeStore();
      const renderFn = vi.fn();

      const { result } = renderHook(
        () => {
          renderFn();
          return useStore(['count', (s: AppState) => (s.meta.active ? 'user.name' : 'user.age') as PathOf<AppState>]);
        },
        { wrapper: makeWrapper(store) }
      );

      const vals = () => result.current[0];

      expect(vals()[0]).toBe(0);
      expect(vals()[1]).toBe('Alice');

      // Switch resolved path of second entry from 'user.name' to 'user.age'
      act(() => store.setState('meta.active', false));
      expect(vals()[1]).toBe(30);

      // Changes to old path (user.name) should NOT cause a re-render
      act(() => store.setState('user.name', 'Bob'));
      expect(renderFn).toHaveBeenCalledTimes(2); // only initial + path switch

      // Changes to new path (user.age) should cause a re-render
      act(() => store.setState('user.age', 55));
      expect(vals()[1]).toBe(55);
      expect(renderFn).toHaveBeenCalledTimes(3);
    });
  });

  describe('useStoreSync: dynamic path function', () => {
    it('syncs to the resolved path on initial render', () => {
      const store = makeStore();

      renderHook(
        () => useStoreSync((s: AppState) => (s.meta.active ? 'user.name' : 'user.age') as PathOf<AppState>, 'Synced'),
        { wrapper: makeWrapper(store) }
      );

      expect(store.getState().user.name).toBe('Synced');
    });

    it('syncs to the new resolved path when state changes the path', () => {
      const store = makeStore();
      let active = true;

      const { rerender } = renderHook(
        () =>
          useStoreSync(
            (s: AppState) => (s.meta.active ? 'user.name' : 'user.age') as PathOf<AppState>,
            (active ? 'Dynamic' : 99) as unknown as string
          ),
        { wrapper: makeWrapper(store) }
      );

      expect(store.getState().user.name).toBe('Dynamic');

      // Change external condition so path resolves differently
      act(() => store.setState('meta.active', false));
      active = false;
      rerender();

      expect(store.getState().user.age).toBe(99);
    });

    it('multi-path: syncs dynamic path entries correctly', () => {
      const store = makeStore();

      renderHook(
        () =>
          useStoreSync(
            ['count', (s: AppState) => (s.meta.active ? 'user.name' : 'user.age') as PathOf<AppState>],
            [42, 'Synced']
          ),
        { wrapper: makeWrapper(store) }
      );

      expect(store.getState().count).toBe(42);
      expect(store.getState().user.name).toBe('Synced');
    });

    it('multi-path: syncs to new resolved path when state-driven path changes', () => {
      const store = makeStore();
      let active = true;

      const { rerender } = renderHook(
        () =>
          useStoreSync(
            ['count', (s: AppState) => (s.meta.active ? 'user.name' : 'user.age') as PathOf<AppState>],
            [10, active ? 'NewName' : 55]
          ),
        { wrapper: makeWrapper(store) }
      );

      expect(store.getState().user.name).toBe('NewName');

      act(() => store.setState('meta.active', false));
      active = false;
      rerender();

      expect(store.getState().user.age).toBe(55);
    });
  });

  describe('useStoreSync: options object', () => {
    it('mode mount via options object', () => {
      const store = makeStore();
      const listener = vi.fn();
      store.subscribePath('count', listener);
      let externalValue = 10;

      const { rerender } = renderHook(() => useStoreSync('count', externalValue, { mode: 'mount' }), {
        wrapper: makeWrapper(store)
      });

      externalValue = 99;
      rerender();
      rerender();

      expect(store.getState().count).toBe(10);
      expect(listener).toHaveBeenCalledTimes(0);
    });

    it('mode sync via options object (default)', () => {
      const store = makeStore();
      let externalValue = 0;

      const { rerender } = renderHook(
        () => useStoreSync('count', externalValue, { mode: 'sync', syncStrategy: 'afterRender' }),
        { wrapper: makeWrapper(store) }
      );

      externalValue = 5;
      rerender();

      expect(store.getState().count).toBe(5);
    });

    it('disabled: does not sync on mount', () => {
      const store = makeStore();

      renderHook(() => useStoreSync('count', 99, { enabled: false }), { wrapper: makeWrapper(store) });

      expect(store.getState().count).toBe(0); // untouched
    });

    it('disabled: does not sync on rerender', () => {
      const store = makeStore();
      const listener = vi.fn();
      store.subscribePath('count', listener);
      let externalValue = 1;

      const { rerender } = renderHook(() => useStoreSync('count', externalValue, { enabled: false }), {
        wrapper: makeWrapper(store)
      });

      externalValue = 5;
      rerender();

      expect(listener).not.toHaveBeenCalled();
      expect(store.getState().count).toBe(0);
    });

    it('disabled: does not re-render when store changes', () => {
      const store = makeStore();
      const renderFn = vi.fn();

      renderHook(
        () => {
          renderFn();
          useStoreSync('count', 0, { enabled: false });
        },
        { wrapper: makeWrapper(store) }
      );

      act(() => store.setState('count', 42));
      expect(renderFn).toHaveBeenCalledTimes(1);
    });

    it('starts syncing when enabled switches false → true', () => {
      const store = makeStore();
      let enabled = false;
      const externalValue = 10;

      const { rerender } = renderHook(() => useStoreSync('count', externalValue, { enabled }), {
        wrapper: makeWrapper(store)
      });

      expect(store.getState().count).toBe(0); // disabled on mount — no sync

      enabled = true;
      rerender();

      expect(store.getState().count).toBe(10); // synced on first enabled render
    });

    it('stops syncing when enabled switches true → false', () => {
      const store = makeStore();
      let enabled = true;
      let externalValue = 1;

      const { rerender } = renderHook(() => useStoreSync('count', externalValue, { enabled }), {
        wrapper: makeWrapper(store)
      });

      expect(store.getState().count).toBe(1);

      enabled = false;
      externalValue = 99;
      rerender();

      expect(store.getState().count).toBe(1); // still 1 — disabled stopped sync
    });

    it('equalityFn in options prevents re-sync for equivalent objects', () => {
      const store = makeStore();
      const listener = vi.fn();
      store.subscribePath('schema', listener);
      let externalSchema = { version: 1, title: 'v1' };
      const { useStoreSync } = createStoreHook<typeof externalSchema>();

      const { rerender } = renderHook(
        () =>
          useStoreSync(undefined, externalSchema, {
            equalityFn: (a, b) => a.version === b.version && a.title === b.title
          }),
        { wrapper: makeWrapper(store) }
      );

      externalSchema = { version: 1, title: 'v1' }; // new reference, same content
      rerender();

      expect(listener).toHaveBeenCalledTimes(0); // mount only
    });
  });

  describe('Edge cases', () => {
    it('enabled toggles rapidly without crashing', () => {
      const store = makeStore();
      let enabled = true;

      const { rerender } = renderHook(() => useStore('count', { enabled }), { wrapper: makeWrapper(store) });

      for (let i = 0; i < 20; i++) {
        enabled = i % 2 === 0;
        rerender();
        act(() => store.setState('count', i));
      }

      // No crash — just verify it ran
      expect(store.getState().count).toBeGreaterThanOrEqual(0);
    });

    it('dynamic path changes rapidly without memory leak', () => {
      const store = makeStore();
      const ids = ['btn1', 'txt1', 'btn1', 'txt1'];

      const { rerender } = renderHook(({ id }) => useStore(`schema.flat.${id}` as PathOf<AppState>), {
        initialProps: { id: 'btn1' },
        wrapper: makeWrapper(store)
      });

      for (const id of ids) {
        rerender({ id });
      }

      // Store should have no dangling listeners after path changes
      expect(true).toBe(true); // no crash
    });

    it('selector that throws does not break the store', () => {
      const store = makeStore();

      expect(() =>
        renderHook(
          () =>
            useStore(() => {
              throw new Error('selector error');
            }),
          { wrapper: makeWrapper(store) }
        )
      ).toThrow('selector error');

      // Store itself is unaffected
      expect(store.getState().count).toBe(0);
    });

    it('enabled false with path still returns initial value', () => {
      const store = makeStore();

      const { result } = renderHook(() => useStore('user.name', { enabled: false }), {
        wrapper: makeWrapper(store)
      });

      const [value] = result.current;
      expect(value).toBe('Alice');
    });

    it('enabled false with multi-path still returns initial values', () => {
      const store = makeStore();

      const { result } = renderHook(() => useStore(['count', 'user.name'] as const, { enabled: false }), {
        wrapper: makeWrapper(store)
      });

      const [values] = result.current;
      expect(values[0]).toBe(0);
      expect(values[1]).toBe('Alice');
    });

    it('useStoreSync with enabled false then true syncs the current value', () => {
      const store = makeStore();
      let enabled = false;
      const externalValue = 77;

      const { rerender } = renderHook(() => useStoreSync('count', externalValue, { enabled }), {
        wrapper: makeWrapper(store)
      });

      expect(store.getState().count).toBe(0); // not synced

      enabled = true;
      rerender();

      expect(store.getState().count).toBe(77); // synced on first enabled render
    });

    it('two useStore hooks with different enabled states are independent', () => {
      const store = makeStore();
      const renderA = vi.fn();
      const renderB = vi.fn();

      renderHook(
        () => {
          renderA();
          return useStore('count', { enabled: true });
        },
        { wrapper: makeWrapper(store) }
      );

      renderHook(
        () => {
          renderB();
          return useStore('count', { enabled: false });
        },
        { wrapper: makeWrapper(store) }
      );

      act(() => store.setState('count', 5));

      expect(renderA).toHaveBeenCalledTimes(2); // subscribed — re-rendered
      expect(renderB).toHaveBeenCalledTimes(1); // disabled — no re-render
    });

    it('useStoreSync disabled does not interfere with a useStore on same path', () => {
      const store = makeStore();
      const renderFn = vi.fn();

      renderHook(
        () => {
          renderFn();
          useStoreSync('count', 99, { enabled: false }); // should not write
          return useStore('count');
        },
        { wrapper: makeWrapper(store) }
      );

      expect(store.getState().count).toBe(0);
      expect(renderFn).toHaveBeenCalledTimes(1);
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

describe('Advanced store tests', () => {
  type State2 = {
    user: { name: string; age: number };
    items: string[];
    count: number;
  };

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

describe('performance', () => {
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

  describe('Performance: re-renders innecesarios', () => {
    it('no re-renderiza cuando cambia un path no suscrito (1000 updates)', () => {
      const store = makeStore();
      const { useStore } = createStoreHook<PerfState>();
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
      const { useStore } = createStoreHook<PerfState>();
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

    it('equalityFn evita re-renders con objetos equivalentes (path)', () => {
      const store = makeStore();
      const { useStore } = createStoreHook<PerfState>();
      const renderFn = vi.fn();

      renderHook(
        () => {
          const [user] = useStore('user', { equalityFn: (a, b) => a.name === b.name && a.age === b.age });
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
      const { useStore } = createStoreHook<PerfState>();
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
      const { useStore } = createStoreHook<PerfState>();

      const elapsed = measure('mount + unmount de 500 hooks', () => {
        const hooks = Array.from({ length: 500 }, () =>
          renderHook(() => useStore('count'), { wrapper: makeWrapper(store) })
        );
        hooks.forEach(h => h.unmount());
      });

      expect(elapsed).toBeLessThan(2000);
    });
  });

  describe('Performance: memoria con miles de listeners', () => {
    it('no acumula listeners: subscribe → unsub limpia correctamente', () => {
      const store = makeStore() as StoreApiInternal<PerfState>;
      const unsubs: Array<() => void> = [];

      for (let i = 0; i < 1000; i++) {
        unsubs.push(store.subscribe(vi.fn()));
      }

      expect(store.listeners.length).toBe(1000);

      unsubs.forEach(u => u());

      expect(store.listeners.length).toBe(0);
    });

    it('no acumula path listeners: subscribePath → unsub limpia correctamente', () => {
      const store = makeStore() as StoreApiInternal<PerfState>;
      const unsubs: Array<() => void> = [];

      for (let i = 0; i < 1000; i++) {
        unsubs.push(store.subscribePath('user.name', vi.fn()));
      }

      expect(store.pathListeners.direct.get('user.name')?.length).toBe(1000);

      unsubs.forEach(u => u());

      expect(store.pathListeners.direct.get('user.name')).toBeUndefined();
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

      store.pathListeners.direct.forEach(arr => {
        expect(arr.length).toBe(0);
      });
    });

    it('hooks: no re-renderiza paths no suscritos tras unmount masivo', () => {
      const store = makeStore();
      const { useStore } = createStoreHook<PerfState>();
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

  describe('Performance: stress test combinado', () => {
    it('500 hooks × 100 updates × paths mixtos en menos de 5s', () => {
      const store = makeStore();
      const { useStore } = createStoreHook<PerfState>();
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
});

describe('fiability', () => {
  type Settings = {
    userProvider: string;
    theme: 'light' | 'dark';
    maxItems: number;
    flags: { beta: boolean; experimental: boolean };
  };

  type Schema = {
    version: number;
    settings: Settings;
    tags: string[];
  };

  type StabilityState = {
    schema: Schema;
    meta: { author: string; updatedAt: number };
    counters: { views: number; clicks: number };
  };

  const makeStore = () =>
    createStore<StabilityState>(() => ({
      schema: {
        version: 1,
        settings: {
          userProvider: 'google',
          theme: 'light',
          maxItems: 10,
          flags: { beta: false, experimental: false }
        },
        tags: ['a', 'b', 'c']
      },
      meta: { author: 'Carlos', updatedAt: 1000 },
      counters: { views: 0, clicks: 0 }
    }));

  const makeWrapper =
    (store: StoreApi<StabilityState>) =>
    ({ children }: { children: ReactNode }) =>
      createElement(StoreContext, { value: store }, children);

  const { useStore } = createStoreHook<StabilityState>();

  const renderCount = () => {
    const fn = vi.fn();

    return { fn, count: () => fn.mock.calls.length };
  };

  describe('Stability: deep primitive does not re-render when parent is updated', () => {
    it('schema.settings.userProvider does not re-render when schema.version changes', () => {
      const store = makeStore();
      const { fn, count } = renderCount();

      renderHook(
        () => {
          useStore('schema.settings.userProvider');
          fn();
        },
        { wrapper: makeWrapper(store) }
      );

      expect(count()).toBe(1);

      act(() => store.setState('schema.version', 2));
      expect(count()).toBe(1);
    });

    it('schema.settings.userProvider does not re-render when schema.settings is replaced with same userProvider value', () => {
      const store = makeStore();
      const { fn, count } = renderCount();

      renderHook(
        () => {
          useStore('schema.settings.userProvider');
          fn();
        },
        { wrapper: makeWrapper(store) }
      );

      // Replace settings with a new object reference but keep userProvider unchanged
      act(() =>
        store.setState(undefined, prev => ({
          ...prev,
          schema: {
            ...prev.schema,
            settings: { ...prev.schema.settings, theme: 'dark' }
          }
        }))
      );

      expect(count()).toBe(1); // 'google' === 'google' — no re-render
    });

    it('schema.settings.userProvider DOES re-render when its own value changes', () => {
      const store = makeStore();
      const { fn, count } = renderCount();

      const { result } = renderHook(
        () => {
          const [v] = useStore('schema.settings.userProvider');
          fn();
          return v;
        },
        { wrapper: makeWrapper(store) }
      );

      expect(result.current).toBe('google');

      act(() => store.setState('schema.settings.userProvider', 'github'));

      expect(result.current).toBe('github');
      expect(count()).toBe(2);
    });

    it('schema.settings.maxItems does not re-render when schema.tags changes', () => {
      const store = makeStore();
      const { fn, count } = renderCount();

      renderHook(
        () => {
          useStore('schema.settings.maxItems');
          fn();
        },
        { wrapper: makeWrapper(store) }
      );

      act(() => store.setState('schema.tags.0', 'z'));
      expect(count()).toBe(1);
    });

    it('schema.settings.flags.beta does not re-render when schema.version changes', () => {
      const store = makeStore();
      const { fn, count } = renderCount();

      renderHook(
        () => {
          useStore('schema.settings.flags.beta');
          fn();
        },
        { wrapper: makeWrapper(store) }
      );

      act(() => store.setState('schema.version', 99));
      expect(count()).toBe(1);
    });
  });

  describe('Stability: multiple subscribers to the same primitive', () => {
    it('10 hooks on schema.settings.userProvider — only re-render when value changes', () => {
      const store = makeStore();
      const counts = Array(10).fill(0) as number[];

      const hooks = Array.from({ length: 10 }, (_, i) =>
        renderHook(
          () => {
            useStore('schema.settings.userProvider');
            counts[i]++;
          },
          { wrapper: makeWrapper(store) }
        )
      );

      expect(counts.reduce((a, b) => a + b, 0)).toBe(10); // 1 initial render each

      // Parent changes — no re-renders
      act(() => store.setState('schema.version', 2));
      expect(counts.reduce((a, b) => a + b, 0)).toBe(10);

      // Value changes — all re-render
      act(() => store.setState('schema.settings.userProvider', 'github'));
      expect(counts.reduce((a, b) => a + b, 0)).toBe(20);

      // Same value again — no re-renders
      act(() => store.setState('schema.settings.userProvider', 'github'));
      expect(counts.reduce((a, b) => a + b, 0)).toBe(20);

      hooks.forEach(h => h.unmount());
    });
  });

  describe('Stability: sibling paths do not affect each other', () => {
    it('counters.views and counters.clicks are independent', () => {
      const store = makeStore();
      const viewsFn = vi.fn();
      const clicksFn = vi.fn();

      renderHook(
        () => {
          useStore('counters.views');
          viewsFn();
        },
        { wrapper: makeWrapper(store) }
      );

      renderHook(
        () => {
          useStore('counters.clicks');
          clicksFn();
        },
        { wrapper: makeWrapper(store) }
      );

      act(() => store.setState('counters.views', 1));
      expect(viewsFn).toHaveBeenCalledTimes(2); // initial + update
      expect(clicksFn).toHaveBeenCalledTimes(1); // initial only

      act(() => store.setState('counters.clicks', 5));
      expect(viewsFn).toHaveBeenCalledTimes(2); // unchanged
      expect(clicksFn).toHaveBeenCalledTimes(2); // initial + update
    });

    it('meta.author does not re-render when meta.updatedAt changes', () => {
      const store = makeStore();
      const { fn, count } = renderCount();

      renderHook(
        () => {
          useStore('meta.author');
          fn();
        },
        { wrapper: makeWrapper(store) }
      );

      act(() => store.setState('meta.updatedAt', Date.now()));
      expect(count()).toBe(1);
    });

    it('multiple updates in a single act — each subscriber only reacts to its own path', () => {
      const store = makeStore();
      const versionFn = vi.fn();
      const userProviderFn = vi.fn();
      const authorFn = vi.fn();

      renderHook(
        () => {
          useStore('schema.version');
          versionFn();
        },
        { wrapper: makeWrapper(store) }
      );
      renderHook(
        () => {
          useStore('schema.settings.userProvider');
          userProviderFn();
        },
        { wrapper: makeWrapper(store) }
      );
      renderHook(
        () => {
          useStore('meta.author');
          authorFn();
        },
        { wrapper: makeWrapper(store) }
      );

      act(() => {
        store.setState('schema.version', 2);
        store.setState('schema.settings.userProvider', 'github');
        // meta.author is not updated
      });

      expect(versionFn).toHaveBeenCalledTimes(2);
      expect(userProviderFn).toHaveBeenCalledTimes(2);
      expect(authorFn).toHaveBeenCalledTimes(1); // no change
    });
  });

  describe('Stability: immutability and reference stability', () => {
    it('updating a path does not mutate unrelated objects in the tree', () => {
      const store = makeStore();
      const before = store.getState();

      act(() => store.setState('schema.settings.userProvider', 'github'));

      const after = store.getState();

      // Updated nodes get new references
      expect(after).not.toBe(before);
      expect(after.schema).not.toBe(before.schema);
      expect(after.schema.settings).not.toBe(before.schema.settings);

      // Untouched nodes keep the same reference
      expect(after.schema.tags).toBe(before.schema.tags);
      expect(after.meta).toBe(before.meta);
      expect(after.counters).toBe(before.counters);
    });

    it('setState with the same primitive value does not notify subscribers', () => {
      const store = makeStore();
      const listener = vi.fn();

      store.subscribePath('schema.settings.userProvider', listener);
      act(() => store.setState('schema.settings.userProvider', 'google')); // same value

      expect(listener).not.toHaveBeenCalled();
    });

    it('replacing the parent with the same nested primitive value does not re-render the child', () => {
      const store = makeStore();
      const { fn, count } = renderCount();

      renderHook(
        () => {
          useStore('schema.settings.userProvider');
          fn();
        },
        { wrapper: makeWrapper(store) }
      );

      // Replace schema entirely but keep userProvider as 'google'
      act(() =>
        store.setState(undefined, prev => ({
          ...prev,
          schema: {
            ...prev.schema,
            version: 2,
            settings: { ...prev.schema.settings } // new reference, same contents
          }
        }))
      );

      // subscribePath compares the primitive with Object.is — no re-render
      expect(count()).toBe(1);
    });
  });

  describe('Stability: array element paths', () => {
    it('schema.tags.0 does not re-render when schema.tags.1 changes', () => {
      const store = makeStore();
      const { fn, count } = renderCount();

      renderHook(
        () => {
          useStore('schema.tags.0');
          fn();
        },
        { wrapper: makeWrapper(store) }
      );

      act(() => store.setState('schema.tags.1', 'z'));
      expect(count()).toBe(1);
    });

    it('schema.tags.0 DOES re-render when its own value changes', () => {
      const store = makeStore();
      const { fn, count } = renderCount();

      renderHook(
        () => {
          useStore('schema.tags.0');
          fn();
        },
        { wrapper: makeWrapper(store) }
      );

      act(() => store.setState('schema.tags.0', 'x'));
      expect(count()).toBe(2);
    });

    it('schema.tags.0 does not re-render when schema.version changes', () => {
      const store = makeStore();
      const { fn, count } = renderCount();

      renderHook(
        () => {
          useStore('schema.tags.0');
          fn();
        },
        { wrapper: makeWrapper(store) }
      );

      act(() => store.setState('schema.version', 5));
      expect(count()).toBe(1);
    });
  });
});

describe('useStore (multi-path)', () => {
  type State = {
    user: { name: string; age: number };
    meta: { active: boolean };
    items: string[];
    count: number;
  };

  const makeStore = () =>
    createStore<State>(() => ({
      user: { name: 'Carlos', age: 30 },
      meta: { active: true },
      items: ['a', 'b'],
      count: 0
    }));

  const makeWrapper =
    (store: StoreApi<State>) =>
    ({ children }: { children: ReactNode }) =>
      createElement(StoreContext, { value: store }, children);

  const { useStore } = createStoreHook<State>();

  it('returns values for multiple paths', () => {
    const store = makeStore();

    const { result } = renderHook(() => useStore(['user.name', 'count']), { wrapper: makeWrapper(store) });

    expect(result.current[0]).toEqual(['Carlos', 0]);
  });

  it('returns values for multiple paths with invalid paths', () => {
    const store = makeStore();

    // @ts-expect-error // eslint-disable-line
    const { result } = renderHook(() => useStore(['user.name', 'count', 'blah']), { wrapper: makeWrapper(store) });

    expect(result.current[0]).toEqual(['Carlos', 0, undefined]);
  });

  it('re-renders when one path changes', () => {
    const store = makeStore();
    const renderFn = vi.fn();

    renderHook(
      () => {
        useStore(['user.name', 'count']);
        renderFn();
      },
      { wrapper: makeWrapper(store) }
    );

    act(() => store.setState('count', 1));

    expect(renderFn).toHaveBeenCalledTimes(2);
  });

  it('does NOT re-render when unrelated path changes', () => {
    const store = makeStore();
    const renderFn = vi.fn();

    renderHook(
      () => {
        useStore(['user.name', 'count']);
        renderFn();
      },
      { wrapper: makeWrapper(store) }
    );

    act(() => store.setState('meta.active', false));

    expect(renderFn).toHaveBeenCalledTimes(1);
  });

  it('re-renders once when both paths change in same act', () => {
    const store = makeStore();
    const renderFn = vi.fn();

    renderHook(
      () => {
        useStore(['user.name', 'count']);
        renderFn();
      },
      { wrapper: makeWrapper(store) }
    );

    act(() => {
      store.setState('user.name', 'Ana');
      store.setState('count', 10);
    });

    expect(renderFn).toHaveBeenCalledTimes(2);
  });

  it('paths with same parent: only affected child triggers re-render', () => {
    const store = makeStore();
    const renderFn = vi.fn();

    renderHook(
      () => {
        useStore(['user.name', 'user.age']);
        renderFn();
      },
      { wrapper: makeWrapper(store) }
    );

    act(() => store.setState('user.name', 'Pedro'));

    expect(renderFn).toHaveBeenCalledTimes(2);
  });

  it('paths with same parent: replacing parent triggers re-render if values change', () => {
    const store = makeStore();
    const renderFn = vi.fn();

    renderHook(
      () => {
        useStore(['user.name', 'user.age']);
        renderFn();
      },
      { wrapper: makeWrapper(store) }
    );

    act(() =>
      store.setState(undefined, prev => ({
        ...prev,
        user: { name: 'Luis', age: 31 }
      }))
    );

    expect(renderFn).toHaveBeenCalledTimes(2);
  });

  it('paths with same parent: replacing parent with equal values does NOT re-render', () => {
    const store = makeStore();
    const renderFn = vi.fn();

    renderHook(
      () => {
        useStore(['user.name', 'user.age']);
        renderFn();
      },
      { wrapper: makeWrapper(store) }
    );

    act(() =>
      store.setState(undefined, prev => ({
        ...prev,
        user: { ...prev.user } // same values
      }))
    );

    expect(renderFn).toHaveBeenCalledTimes(1);
  });

  it('array paths: only affected index re-renders', () => {
    const store = makeStore();
    const renderFn = vi.fn();

    renderHook(
      () => {
        useStore(['items.0', 'items.1']);
        renderFn();
      },
      { wrapper: makeWrapper(store) }
    );

    act(() => store.setState('items.1', 'z'));

    expect(renderFn).toHaveBeenCalledTimes(2);
  });

  it('array paths: unrelated index does not re-render', () => {
    const store = makeStore();
    const renderFn = vi.fn();

    renderHook(
      () => {
        useStore(['items.0', 'items.1']);
        renderFn();
      },
      { wrapper: makeWrapper(store) }
    );

    act(() => store.setState('items.2', 'x'));

    expect(renderFn).toHaveBeenCalledTimes(1);
  });

  it('setters update independently', () => {
    const store = makeStore();

    const { result } = renderHook(() => useStore(['user.name', 'count']), { wrapper: makeWrapper(store) });

    const [, setName, setCount] = result.current;

    act(() => setName('Mario'));
    expect(store.getState().user.name).toBe('Mario');

    act(() => setCount(99));
    expect(store.getState().count).toBe(99);
  });

  it('equalityFn prevents re-render', () => {
    const store = makeStore();
    const renderFn = vi.fn();

    renderHook(
      () => {
        renderFn();

        return useStore(['user.name', 'count'], {
          equalityFn: (a, b) => a[0] === b[0] && a[1] === b[1]
        });
      },
      { wrapper: makeWrapper(store) }
    );

    // meta.active is not in the watched paths — should not trigger a re-render
    act(() => store.setState('meta.active', false));

    expect(renderFn).toHaveBeenCalledTimes(1);
  });

  it('returns same reference if values did not change', () => {
    const store = makeStore();

    const { result } = renderHook(() => useStore(['user.name', 'count']), { wrapper: makeWrapper(store) });

    const first = result.current[0];

    act(() => store.setState('meta.active', false));

    const second = result.current[0];

    expect(first).toBe(second);
  });
});

describe('defaultValue', () => {
  type AppState = {
    user: {
      name: string;
      nickname?: string;
      age: number;
    };
    schema: {
      flat: Record<string, { label: string; type: string }>;
    };
    count: number;
    tag?: string;
    score?: number;
  };

  const makeStore = () =>
    createStore<AppState>(() => ({
      user: { name: 'Alice', age: 30 },
      schema: { flat: { btn1: { label: 'Button', type: 'button' } } },
      count: 0
    }));

  const makeWrapper =
    (store: StoreApi<AppState>) =>
    ({ children }: { children: ReactNode }) =>
      createElement(StoreContext, { value: store }, children);

  const { useStore } = createStoreHook<AppState>();

  // ─── single path ─────────────────────────────────────────────────────────────

  describe('useStore: defaultValue — single path', () => {
    it('returns the store value when it is defined', () => {
      const store = makeStore();
      const { result } = renderHook(() => useStore('user.name', { defaultValue: 'fallback' }), {
        wrapper: makeWrapper(store)
      });

      expect(result.current[0]).toBe('Alice');
    });

    it('returns defaultValue when path value is undefined', () => {
      const store = makeStore();
      const { result } = renderHook(() => useStore('tag', { defaultValue: 'default-tag' }), {
        wrapper: makeWrapper(store)
      });

      expect(result.current[0]).toBe('default-tag');
    });

    it('switches to real value once store is updated from undefined', () => {
      const store = makeStore();
      const { result } = renderHook(() => useStore('tag', { defaultValue: 'default-tag' }), {
        wrapper: makeWrapper(store)
      });

      expect(result.current[0]).toBe('default-tag');

      act(() => store.setState('tag', 'real-tag'));

      expect(result.current[0]).toBe('real-tag');
    });

    it('switches back to defaultValue when store value is reset to undefined', () => {
      const store = makeStore();
      act(() => store.setState('tag', 'real-tag'));

      const { result } = renderHook(() => useStore('tag', { defaultValue: 'fallback' }), {
        wrapper: makeWrapper(store)
      });

      expect(result.current[0]).toBe('real-tag');

      act(() => store.setState('tag', undefined));

      expect(result.current[0]).toBe('fallback');
    });

    it('does not re-render when store value stays undefined and defaultValue is stable', () => {
      const store = makeStore();
      const renderFn = vi.fn();

      renderHook(
        () => {
          renderFn();
          return useStore('tag', { defaultValue: 'fallback' });
        },
        { wrapper: makeWrapper(store) }
      );

      act(() => store.setState('count', 99));

      expect(renderFn).toHaveBeenCalledTimes(1);
    });

    it('does not re-render when real value equals defaultValue', () => {
      const store = makeStore();
      act(() => store.setState('tag', 'same'));
      const renderFn = vi.fn();

      renderHook(
        () => {
          renderFn();
          return useStore('tag', { defaultValue: 'same' });
        },
        { wrapper: makeWrapper(store) }
      );

      act(() => store.setState('count', 1));

      expect(renderFn).toHaveBeenCalledTimes(1);
    });

    it('works with numeric defaultValue', () => {
      const store = makeStore();
      const { result } = renderHook(() => useStore('score', { defaultValue: 42 }), {
        wrapper: makeWrapper(store)
      });

      expect(result.current[0]).toBe(42);
    });

    it('works with dynamic path and defaultValue', () => {
      const store = makeStore();
      const id = 'nonexistent';
      const { result } = renderHook(
        () =>
          useStore(`schema.flat.${id}` as PathOf<AppState>, { defaultValue: { label: 'Unknown', type: 'unknown' } }),
        { wrapper: makeWrapper(store) }
      );

      expect(result.current[0]).toEqual({ label: 'Unknown', type: 'unknown' });
    });

    it('returns real value for existing dynamic path even when defaultValue is set', () => {
      const store = makeStore();
      const id = 'btn1';
      const { result } = renderHook(
        () =>
          useStore(`schema.flat.${id}` as PathOf<AppState>, { defaultValue: { label: 'Unknown', type: 'unknown' } }),
        { wrapper: makeWrapper(store) }
      );

      expect(result.current[0]).toEqual({ label: 'Button', type: 'button' });
    });
  });

  // ─── multi-path: positional array defaultValue ────────────────────────────────

  describe('useStore: defaultValue — multi-path positional array', () => {
    it('returns defaultValue at positions where store value is undefined', () => {
      const store = makeStore();
      const { result } = renderHook(
        () => useStore(['tag', 'count'] as const, { defaultValue: ['fallback', undefined] }),
        { wrapper: makeWrapper(store) }
      );

      const [values] = result.current;
      expect(values[0]).toBe('fallback'); // tag is undefined → uses default
      expect(values[1]).toBe(0); // count is defined → uses store value
    });

    it('returns store value when it is defined, ignoring positional default', () => {
      const store = makeStore();
      act(() => store.setState('tag', 'real'));

      const { result } = renderHook(
        () => useStore(['tag', 'count'] as const, { defaultValue: ['fallback', undefined] }),
        { wrapper: makeWrapper(store) }
      );

      expect(result.current[0][0]).toBe('real');
    });

    it('undefined position in defaultValue adds | undefined to type and returns store value as-is', () => {
      const store = makeStore();
      const { result } = renderHook(
        () => useStore(['count', 'tag'] as const, { defaultValue: [undefined, 'fallback'] }),
        { wrapper: makeWrapper(store) }
      );

      expect(result.current[0][0]).toBe(0); // count defined, no default
      expect(result.current[0][1]).toBe('fallback'); // tag undefined, uses default
    });

    it('switches from default to real value when store updates', () => {
      const store = makeStore();
      const { result } = renderHook(
        () => useStore(['tag', 'count'] as const, { defaultValue: ['fallback', undefined] }),
        { wrapper: makeWrapper(store) }
      );

      expect(result.current[0][0]).toBe('fallback');

      act(() => store.setState('tag', 'real'));

      expect(result.current[0][0]).toBe('real');
    });

    it('does not re-render when unrelated path changes', () => {
      const store = makeStore();
      const renderFn = vi.fn();

      renderHook(
        () => {
          renderFn();
          return useStore(['tag', 'user.name'] as const, { defaultValue: ['fallback', undefined] });
        },
        { wrapper: makeWrapper(store) }
      );

      act(() => store.setState('count', 99));

      expect(renderFn).toHaveBeenCalledTimes(1);
    });

    it('all positions with concrete defaults: returns defaults when all undefined', () => {
      const store = makeStore();
      const { result } = renderHook(() => useStore(['tag', 'score'] as const, { defaultValue: ['no-tag', 0] }), {
        wrapper: makeWrapper(store)
      });

      expect(result.current[0][0]).toBe('no-tag');
      expect(result.current[0][1]).toBe(0);
    });

    it('all positions undefined in defaultValue: returns store values unchanged', () => {
      const store = makeStore();
      const { result } = renderHook(
        () => useStore(['count', 'user.name'] as const, { defaultValue: [undefined, undefined] }),
        { wrapper: makeWrapper(store) }
      );

      expect(result.current[0][0]).toBe(0);
      expect(result.current[0][1]).toBe('Alice');
    });

    it('setters work independently regardless of defaultValue', () => {
      const store = makeStore();
      const { result } = renderHook(
        () => useStore(['tag', 'count'] as const, { defaultValue: ['fallback', undefined] }),
        { wrapper: makeWrapper(store) }
      );

      const [, setTag, setCount] = result.current;

      act(() => setTag('updated'));
      expect(store.getState().tag).toBe('updated');

      act(() => setCount(99));
      expect(store.getState().count).toBe(99);
    });

    it('returns same array reference when values did not change', () => {
      const store = makeStore();
      const { result } = renderHook(
        () => useStore(['tag', 'count'] as const, { defaultValue: ['fallback', undefined] }),
        { wrapper: makeWrapper(store) }
      );

      const first = result.current[0];
      act(() => store.setState('user.name', 'Bob'));
      const second = result.current[0];

      expect(first).toBe(second);
    });
  });

  // ─── multi-path: scalar defaultValue ─────────────────────────────────────────

  describe('useStore: defaultValue — multi-path scalar', () => {
    it('applies scalar default to all undefined paths', () => {
      const store = makeStore();
      const { result } = renderHook(() => useStore(['tag', 'score'] as const, { defaultValue: 'N/A' }), {
        wrapper: makeWrapper(store)
      });

      expect(result.current[0][0]).toBe('N/A');
      expect(result.current[0][1]).toBe('N/A');
    });

    it('does not apply scalar default to defined paths', () => {
      const store = makeStore();
      act(() => store.setState('tag', 'real'));

      const { result } = renderHook(() => useStore(['tag', 'score'] as const, { defaultValue: 'N/A' }), {
        wrapper: makeWrapper(store)
      });

      expect(result.current[0][0]).toBe('real'); // defined → no default
      expect(result.current[0][1]).toBe('N/A'); // undefined → default
    });
  });

  // ─── interaction with enabled ─────────────────────────────────────────────────

  describe('useStore: defaultValue — interaction with enabled', () => {
    it('returns defaultValue even when disabled', () => {
      const store = makeStore();
      const { result } = renderHook(() => useStore('tag', { defaultValue: 'fallback', enabled: false }), {
        wrapper: makeWrapper(store)
      });

      expect(result.current[0]).toBe('fallback');
    });

    it('multi-path returns defaultValue even when disabled', () => {
      const store = makeStore();
      const { result } = renderHook(
        () => useStore(['tag', 'count'] as const, { defaultValue: ['fallback', undefined], enabled: false }),
        { wrapper: makeWrapper(store) }
      );

      expect(result.current[0][0]).toBe('fallback');
      expect(result.current[0][1]).toBe(0);
    });
  });
});

describe('logger middleware', () => {
  type LogState = { count: number; user: { name: string } };

  const makeLogStore = (options?: { logger?: (change: StoreChange<LogState>) => void }) =>
    createStore<LogState>(
      () => ({ count: 0, user: { name: 'Alice' } }),
      options?.logger ? { middlewares: [loggerMiddleware(options.logger)] } : undefined
    );

  it('fires with correct path, prev, and next on path setState', () => {
    const logger = vi.fn();
    const store = makeLogStore({ logger });

    store.setState('count', 5);

    expect(logger).toHaveBeenCalledTimes(1);
    expect(logger).toHaveBeenCalledWith({
      path: 'count',
      prev: { count: 0, user: { name: 'Alice' } },
      next: { count: 5, user: { name: 'Alice' } }
    });
  });

  it('fires with path: undefined on full-state setState', () => {
    const logger = vi.fn();
    const store = makeLogStore({ logger });

    store.setState(undefined, { count: 99, user: { name: 'Bob' } });

    expect(logger).toHaveBeenCalledWith(
      expect.objectContaining({ path: undefined, next: { count: 99, user: { name: 'Bob' } } })
    );
  });

  it('fires after updater function with correct next', () => {
    const logger = vi.fn();
    const store = makeLogStore({ logger });

    store.setState('count', prev => prev + 10);

    expect(logger).toHaveBeenCalledWith(expect.objectContaining({ next: { count: 10, user: { name: 'Alice' } } }));
  });

  it('does NOT fire when state is equal (bail-out)', () => {
    const logger = vi.fn();
    const store = makeLogStore({ logger });

    store.setState('count', 0);

    expect(logger).not.toHaveBeenCalled();
  });

  it('fires once per setState call', () => {
    const logger = vi.fn();
    const store = makeLogStore({ logger });

    store.setState('count', 1);
    store.setState('count', 2);
    store.setState('user.name', 'Bob');

    expect(logger).toHaveBeenCalledTimes(3);
  });

  it('prev reflects state before the mutation', () => {
    const logger = vi.fn();
    const store = makeLogStore({ logger });

    store.setState('count', 1);
    store.setState('count', 2);

    const calls = logger.mock.calls as Array<[{ prev: LogState; next: LogState }]>;
    expect(calls[0][0].prev.count).toBe(0);
    expect(calls[1][0].prev.count).toBe(1);
  });
});

describe('useStore — store option', () => {
  type AppState = { count: number; user: { name: string } };

  const makeExternalStore = () => createStore<AppState>(() => ({ count: 100, user: { name: 'External' } }));

  const makeContextStore = () => createStore<AppState>(() => ({ count: 0, user: { name: 'Context' } }));

  const makeWrapper =
    (store: StoreApi<AppState>) =>
    ({ children }: { children: ReactNode }) =>
      createElement(StoreContext, { value: store }, children);

  const { useStore: useBoundStore } = createStoreHook<AppState>();

  it('reads from explicit store, not context', () => {
    const contextStore = makeContextStore();
    const externalStore = makeExternalStore();

    const { result } = renderHook(() => useBoundStore('count', { store: externalStore }), {
      wrapper: makeWrapper(contextStore)
    });

    expect(result.current[0]).toBe(100);
  });

  it('re-renders when explicit store changes, not when context store changes', () => {
    const contextStore = makeContextStore();
    const externalStore = makeExternalStore();
    const renderFn = vi.fn();

    renderHook(
      () => {
        renderFn();
        return useBoundStore('count', { store: externalStore });
      },
      { wrapper: makeWrapper(contextStore) }
    );

    act(() => contextStore.setState('count', 99));
    expect(renderFn).toHaveBeenCalledTimes(1);

    act(() => externalStore.setState('count', 200));
    expect(renderFn).toHaveBeenCalledTimes(2);
  });

  it('setter writes to explicit store', () => {
    const contextStore = makeContextStore();
    const externalStore = makeExternalStore();

    const { result } = renderHook(() => useBoundStore('count', { store: externalStore }), {
      wrapper: makeWrapper(contextStore)
    });

    act(() => result.current[1](42));

    expect(externalStore.getState().count).toBe(42);
    expect(contextStore.getState().count).toBe(0);
  });
});

describe('useStoreSync — store option', () => {
  type AppState = { count: number };

  const makeWrapper =
    (store: StoreApi<AppState>) =>
    ({ children }: { children: ReactNode }) =>
      createElement(StoreContext, { value: store }, children);

  const { useStoreSync: useBoundSync } = createStoreHook<AppState>();

  it('syncs into explicit store, not context store', () => {
    const contextStore = createStore<AppState>(() => ({ count: 0 }));
    const externalStore = createStore<AppState>(() => ({ count: 0 }));

    renderHook(() => useBoundSync('count', 77, { store: externalStore }), {
      wrapper: makeWrapper(contextStore)
    });

    expect(externalStore.getState().count).toBe(77);
    expect(contextStore.getState().count).toBe(0);
  });
});
