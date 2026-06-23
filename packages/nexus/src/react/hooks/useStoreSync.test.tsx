import { renderHook, act } from '@testing-library/react';
import { createElement, useState } from 'react';
import { describe, it, expect, vi } from 'vitest';

import { createStoreHook } from '..';
import createStore from '../../createStore';
import { StoreContext } from '../StoreProvider';

import type { StoreApi } from '../../types';
import type { ReactNode } from 'react';

type SyncState = {
  schema: { version: number; title: string };
  count: number;
  user: { name: string; role: 'admin' | 'viewer' };
  tags: string[];
};

const makeStore = () =>
  createStore<SyncState>(() => ({
    schema: { version: 1, title: 'default' },
    count: 0,
    user: { name: 'Alice', role: 'viewer' },
    tags: ['a', 'b']
  }));

const makeWrapper =
  (store: StoreApi<SyncState>) =>
  ({ children }: { children: ReactNode }) =>
    createElement(StoreContext, { value: store }, children);

const { useStoreSync } = createStoreHook<SyncState>();

describe('useStoreSync: mount behavior', () => {
  it('writes the initial value to the store on mount', () => {
    const store = makeStore();

    renderHook(() => useStoreSync('count', 42), { wrapper: makeWrapper(store) });

    expect(store.getState().count).toBe(42);
  });

  it('writes a nested path value on mount', () => {
    const store = makeStore();

    renderHook(() => useStoreSync('schema.title', 'my-schema'), { wrapper: makeWrapper(store) });

    expect(store.getState().schema.title).toBe('my-schema');
  });

  it('throws if used outside a StoreProvider', () => {
    expect(() => renderHook(() => useStoreSync('count', 1))).toThrow(
      'useStoreSync must be used inside a StoreProvider'
    );
  });
});

describe('useStoreSync: sync mode', () => {
  it('updates the store when the incoming value changes', () => {
    const store = makeStore();
    let externalValue = 'Alice';

    const { rerender } = renderHook(() => useStoreSync('user.name', externalValue, { syncStrategy: 'afterRender' }), {
      wrapper: makeWrapper(store)
    });

    expect(store.getState().user.name).toBe('Alice');

    externalValue = 'Bob';
    rerender();

    expect(store.getState().user.name).toBe('Bob');
  });

  it('does NOT write to the store when the value has not changed', () => {
    const store = makeStore();
    const listener = vi.fn();
    store.subscribePath('count', listener);

    const { rerender } = renderHook(() => useStoreSync('count', 5), { wrapper: makeWrapper(store) });

    rerender();
    rerender();

    expect(listener).toHaveBeenCalledTimes(0);
  });

  it('syncs multiple times as the external value changes', () => {
    const store = makeStore();
    let externalCount = 0;

    const { rerender } = renderHook(() => useStoreSync('count', externalCount, { syncStrategy: 'afterRender' }), {
      wrapper: makeWrapper(store)
    });

    for (let i = 1; i <= 5; i++) {
      externalCount = i;
      rerender();
      expect(store.getState().count).toBe(i);
    }
  });
});

describe('useStoreSync: mount mode', () => {
  it('writes the value only once on mount, ignores subsequent changes', () => {
    const store = makeStore();
    const listener = vi.fn();
    store.subscribePath('count', listener);

    let externalValue = 10;

    const { rerender } = renderHook(() => useStoreSync('count', externalValue, { mode: 'mount' }), {
      wrapper: makeWrapper(store)
    });

    expect(store.getState().count).toBe(10);

    externalValue = 99;
    rerender();
    rerender();

    expect(store.getState().count).toBe(10);
    expect(listener).toHaveBeenCalledTimes(0);
  });
});

describe('useStoreSync: custom equalityFn', () => {
  it('does not re-sync when equalityFn returns true for new reference', () => {
    const store = makeStore();
    const listener = vi.fn();
    store.subscribePath('schema', listener);

    const schema1 = { version: 1, title: 'same' };
    let externalSchema = schema1;

    const { rerender } = renderHook(
      () =>
        useStoreSync('schema', externalSchema, {
          mode: 'sync',
          equalityFn: (a, b) => a.version === b.version && a.title === b.title
        }),
      { wrapper: makeWrapper(store) }
    );

    externalSchema = { version: 1, title: 'same' };
    rerender();

    expect(listener).toHaveBeenCalledTimes(0);
  });

  it('re-syncs when equalityFn returns false', () => {
    const store = makeStore();
    const listener = vi.fn();
    store.subscribePath('schema', listener);

    let externalSchema = { version: 1, title: 'v1' };

    const { rerender } = renderHook(
      () =>
        useStoreSync('schema', externalSchema, {
          mode: 'sync',
          syncStrategy: 'afterRender',
          equalityFn: (a, b) => a.version === b.version && a.title === b.title
        }),
      {
        wrapper: makeWrapper(store)
      }
    );

    externalSchema = { version: 2, title: 'v2' };
    rerender();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState().schema.version).toBe(2);
  });
});

describe('useStoreSync: interaction with other subscribers', () => {
  it('notifies other path subscribers when value is synced', () => {
    const store = makeStore();
    const listener = vi.fn();
    store.subscribePath('count', listener);

    let externalCount = 1;

    const { rerender } = renderHook(() => useStoreSync('count', externalCount, { syncStrategy: 'afterRender' }), {
      wrapper: makeWrapper(store)
    });

    externalCount = 5;
    rerender();

    externalCount = 10;
    rerender();

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('does not affect sibling paths when syncing', () => {
    const store = makeStore();
    const userListener = vi.fn();
    store.subscribePath('user.name', userListener);

    let externalCount = 0;
    const { rerender } = renderHook(() => useStoreSync('count', externalCount, { syncStrategy: 'afterRender' }), {
      wrapper: makeWrapper(store)
    });

    externalCount = 1;
    rerender();

    expect(userListener).not.toHaveBeenCalled();
  });

  it('two hooks syncing different paths coexist without interference', () => {
    const store = makeStore();

    let externalCount = 0;
    let externalName = 'Alice';

    const { rerender } = renderHook(
      () => {
        useStoreSync('count', externalCount, { syncStrategy: 'afterRender' });
        useStoreSync('user.name', externalName, { syncStrategy: 'afterRender' });
      },
      { wrapper: makeWrapper(store) }
    );

    externalCount = 7;
    externalName = 'Bob';
    rerender();

    expect(store.getState().count).toBe(7);
    expect(store.getState().user.name).toBe('Bob');
  });
});

describe('useStoreSync: driven by React local state', () => {
  it('syncs to the store when local state changes', () => {
    const store = makeStore();

    const { result } = renderHook(
      () => {
        const [localCount, setLocalCount] = useState(0);
        useStoreSync('count', localCount, { syncStrategy: 'afterRender' });
        return { setLocalCount };
      },
      { wrapper: makeWrapper(store) }
    );

    expect(store.getState().count).toBe(0);

    act(() => result.current.setLocalCount(42));

    expect(store.getState().count).toBe(42);
  });

  it('mount mode: local state changes after mount do not update the store', () => {
    const store = makeStore();

    const { result } = renderHook(
      () => {
        const [localCount, setLocalCount] = useState(10);
        useStoreSync('count', localCount, { mode: 'mount' });
        return { setLocalCount };
      },
      { wrapper: makeWrapper(store) }
    );

    act(() => result.current.setLocalCount(99));

    expect(store.getState().count).toBe(10);
  });
});
