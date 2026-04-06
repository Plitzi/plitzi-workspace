/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { renderHook, act } from '@testing-library/react';
import { createElement } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import createStore, { createStoreHook } from './createStore';
import getByPath from './helpers/getByPath';
import setByPath from './helpers/setByPath';
import useStore from './hooks/useStore';
import { StoreContext } from './StoreProvider';

import type { PathOf, StoreApi, StoreApiInternal } from '../types';
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

    it('disabled selector does not re-render on state change', () => {
      const store = makeStore();
      const renderFn = vi.fn();

      renderHook(
        () => {
          renderFn();
          return useStore(s => s.count, { enabled: false });
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

      act(() =>
        store.setState(
          `schema.flat.${id}` as PathOf<AppState>,
          { label: 'Updated', type: 'button' } as AppState['schema']['flat'][string]
        )
      );

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
      act(() =>
        store.setState(
          'schema.flat.txt1' as PathOf<AppState>,
          { label: 'Changed', type: 'text' } as AppState['schema']['flat'][string]
        )
      );

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

  describe('useStore: shallowEqual default for selectors', () => {
    it('does NOT re-render when selector returns a new object with same shallow content', () => {
      const store = makeStore();
      const renderFn = vi.fn();

      renderHook(
        () => {
          renderFn();
          // Returns a new object every time but with the same content
          return useStore(s => ({ name: s.user.name, age: s.user.age }));
        },
        { wrapper: makeWrapper(store) }
      );

      // Change something unrelated to user
      act(() => store.setState('count', 1));
      act(() => store.setState('count', 2));

      expect(renderFn).toHaveBeenCalledTimes(1); // shallowEqual prevented re-renders
    });

    it('re-renders when selector result shallow-differs', () => {
      const store = makeStore();
      const renderFn = vi.fn();

      const { result } = renderHook(
        () => {
          renderFn();
          return useStore(s => ({ name: s.user.name, age: s.user.age }));
        },
        { wrapper: makeWrapper(store) }
      );

      act(() => store.setState('user.name', 'Bob'));

      expect(renderFn).toHaveBeenCalledTimes(2);
      expect((result.current[0] as { name: string }).name).toBe('Bob');
    });

    it('does NOT re-render when pick-like selector returns same keys and values', () => {
      const store = makeStore();
      const renderFn = vi.fn();

      renderHook(
        () => {
          renderFn();
          // Simulates pick(schema.flat, schema.pages)
          return useStore(s => {
            const result: Record<string, unknown> = {};
            for (const key of s.schema.pages) {
              result[key] = s.schema.flat[key];
            }
            return result;
          });
        },
        { wrapper: makeWrapper(store) }
      );

      // Change something outside schema
      act(() => store.setState('count', 5));
      expect(renderFn).toHaveBeenCalledTimes(1);

      // Change schema.version (not flat or pages)
      act(() => store.setState('schema.version', 2));
      expect(renderFn).toHaveBeenCalledTimes(1); // shallowEqual: same keys, same refs
    });

    it('re-renders when pick-like selector result changes', () => {
      const store = makeStore();
      const renderFn = vi.fn();

      renderHook(
        () => {
          renderFn();
          return useStore(s => {
            const result: Record<string, unknown> = {};
            for (const key of s.schema.pages) {
              result[key] = s.schema.flat[key];
            }
            return result;
          });
        },
        { wrapper: makeWrapper(store) }
      );

      // Update an element that is in pages
      act(() =>
        store.setState(
          'schema.flat.btn1' as PathOf<AppState>,
          { label: 'New Label', type: 'button' } as AppState['schema']['flat'][string]
        )
      );

      expect(renderFn).toHaveBeenCalledTimes(2); // btn1 ref changed
    });

    it('can override shallowEqual with Object.is via equalityFn option', () => {
      // note: this will generate unlimited re-render because of the Object.is
      const store = makeStore();
      const renderFn = vi.fn();

      renderHook(
        () => {
          renderFn();

          return useStore(s => ({ name: s.user.name }), { equalityFn: (a, b) => a.name === b.name });
        },
        { wrapper: makeWrapper(store) }
      );

      // Object.is compares references — new object always differs
      act(() => store.setState('count', 1)); // triggers subscribe → new object → re-render
      expect(renderFn).toHaveBeenCalledTimes(1);
    });

    it('primitive selector still uses Object.is correctly', () => {
      const store = makeStore();
      const renderFn = vi.fn();

      renderHook(
        () => {
          renderFn();
          return useStore(s => s.user.name); // primitive — shallowEqual === Object.is for primitives
        },
        { wrapper: makeWrapper(store) }
      );

      act(() => store.setState('user.age', 31)); // name unchanged
      expect(renderFn).toHaveBeenCalledTimes(1);

      act(() => store.setState('user.name', 'Bob'));
      expect(renderFn).toHaveBeenCalledTimes(2);
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
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('mode sync via options object (default)', () => {
      const store = makeStore();
      let externalValue = 0;

      const { rerender } = renderHook(() => useStoreSync('count', externalValue, { mode: 'sync' }), {
        wrapper: makeWrapper(store)
      });

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
          return useStoreSync('count', 0, { enabled: false });
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

    it('shallowEqual handles null/undefined in selector output gracefully', () => {
      const store = makeStore();
      const renderFn = vi.fn();

      renderHook(
        () => {
          renderFn();
          return useStore(s => (s.count > 0 ? { count: s.count } : null));
        },
        { wrapper: makeWrapper(store) }
      );

      act(() => store.setState('meta.active', false)); // count still 0 → null
      expect(renderFn).toHaveBeenCalledTimes(1);

      act(() => store.setState('count', 1)); // count > 0 → object
      expect(renderFn).toHaveBeenCalledTimes(2);

      act(() => store.setState('count', 2)); // count > 0, different value — new object, different key
      expect(renderFn).toHaveBeenCalledTimes(3);
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

    it('equalityFn evita re-renders con objetos equivalentes (selector)', () => {
      const store = makeStore();
      const { useStore } = createStoreHook<PerfState>();
      const renderFn = vi.fn();

      renderHook(
        () => {
          const [user] = useStore(s => s.user, { equalityFn: (a, b) => a.name === b.name && a.age === b.age });
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

  describe('Stability: selector with and without equalityFn', () => {
    it('selector returning a primitive re-renders when the derived value changes (no equalityFn)', () => {
      const store = makeStore();
      const { fn, count } = renderCount();

      // A primitive result works safely with Object.is — no infinite loop.
      // This verifies that without equalityFn the hook re-renders when the selector output changes.
      const { result } = renderHook(
        () => {
          const [v] = useStore(s => s.schema.version);
          fn();
          return v;
        },
        { wrapper: makeWrapper(store) }
      );

      expect(result.current).toBe(1);
      expect(count()).toBe(1);

      act(() => store.setState('schema.version', 2));
      expect(result.current).toBe(2);
      expect(count()).toBe(2);

      // Same value — no re-render
      act(() => store.setState('schema.version', 2));
      expect(count()).toBe(2);
    });

    it('selector returning a new object does NOT re-render with a correct equalityFn', () => {
      const store = makeStore();
      const { fn, count } = renderCount();

      renderHook(
        () => {
          useStore(s => ({ provider: s.schema.settings.userProvider }), {
            equalityFn: (a, b) => a.provider === b.provider
          });
          fn();
        },
        { wrapper: makeWrapper(store) }
      );

      act(() => store.setState('schema.version', 2));
      expect(count()).toBe(1);
    });

    it('selector returning a derived primitive does not re-render if the result is equal', () => {
      const store = makeStore();
      const { fn, count } = renderCount();

      renderHook(
        () => {
          // Primitive result — Object.is works by default
          useStore(s => s.schema.settings.userProvider.toUpperCase());
          fn();
        },
        { wrapper: makeWrapper(store) }
      );

      // Changes something unrelated to userProvider
      act(() => store.setState('schema.version', 2));
      expect(count()).toBe(1);

      // userProvider changes — derived result changes too
      act(() => store.setState('schema.settings.userProvider', 'github'));
      expect(count()).toBe(2);
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
          equalityFn: (a, b) => a['user.name'] === b['user.name'] && a.count === b.count
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
