import { renderHook, act } from '@testing-library/react';
import { createElement, useContext } from 'react';
import { describe, it, expect, vi } from 'vitest';

import createStore, { createStoreHook } from './createStore';
import StoreProvider, { StoreContext } from './StoreProvider';

import type { StoreApi, StoreApiInternal, StoreChange } from './types';
import type { ReactNode } from 'react';

type S = { a: number; b: number; c: number; z?: number };

const makeChain = () => {
  const parent = createStore<S>({ a: 1, b: 2 });
  const child = createStore<S>({ c: 9 }, { parent });

  return { parent, child };
};

describe('scoped store: live chain (createStore)', () => {
  it('reads inherited keys through the parent and own keys locally', () => {
    const { child } = makeChain();

    expect(child.getState().a).toBe(1); // inherited
    expect(child.getState().b).toBe(2); // inherited
    expect(child.getState().c).toBe(9); // own
  });

  it('shadows a parent key with its own value', () => {
    const parent = createStore<S>({ a: 1, b: 2 });
    const child = createStore<S>({ a: 100, c: 9 }, { parent });

    expect(child.getState().a).toBe(100); // own shadows parent
    expect(parent.getState().a).toBe(1); // parent untouched
  });

  it('delegates writes of inherited paths to the owning parent scope', () => {
    const { parent, child } = makeChain();
    const sibling = createStore<S>({}, { parent });

    child.setState('a', 50);

    expect(parent.getState().a).toBe(50);
    expect(child.getState().a).toBe(50); // visible through the chain
    expect(sibling.getState().a).toBe(50); // visible to siblings too
  });

  it('keeps writes of owned paths local to the scope', () => {
    const { parent, child } = makeChain();

    child.setState('c', 99);

    expect(child.getState().c).toBe(99);
    expect(parent.getState().c).toBeUndefined();
  });

  it('delegates writes of keys it does not own up to the root', () => {
    const { parent, child } = makeChain();

    child.setState('z', 7);

    expect(parent.getState().z).toBe(7); // unowned key delegated to root
    expect(child.getState().z).toBe(7); // visible through the chain
  });

  it('deep-merges nested slices instead of shadowing the whole branch', () => {
    type N = { runtime?: { sources?: Record<string, unknown> } };
    const parent = createStore<N>({ runtime: { sources: { variables: { a: 1 } } } });
    const child = createStore<N>({ runtime: { sources: { record: { b: 2 } } } }, { parent });

    // Child contributes `runtime.sources.record` without clobbering the parent's `runtime.sources.variables`.
    expect(child.getState().runtime?.sources).toEqual({ variables: { a: 1 }, record: { b: 2 } });
    expect(parent.getState().runtime?.sources).toEqual({ variables: { a: 1 } });
  });

  it('delegates a deeply-nested write to a root that never seeded the branch (no seeding)', () => {
    type N = { runtime?: { sources?: { variables?: Record<string, unknown>; collection?: Record<string, unknown> } } };
    const root = createStore<N>({});
    const mid = createStore<N>({ runtime: { sources: { collection: { items: [] } } } }, { parent: root });
    const leaf = createStore<N>({}, { parent: mid });

    leaf.setState('runtime.sources.variables', { a: 1 });

    // Nobody between leaf and root owns `runtime`, so the write delegates all the way to the root, and the
    // chain still deep-merges the mid scope's own `runtime.sources.collection` on read.
    expect(root.getState().runtime?.sources).toEqual({ variables: { a: 1 } });
    expect(leaf.getState().runtime?.sources).toEqual({ collection: { items: [] }, variables: { a: 1 } });
  });

  it('wakes child subscribers when the parent changes an inherited key', () => {
    const { parent, child } = makeChain();
    const listener = vi.fn();
    const pathListener = vi.fn();
    child.subscribe(listener);
    child.subscribePath('a', pathListener);

    parent.setState('a', 10);

    expect(listener).toHaveBeenCalled();
    expect(pathListener).toHaveBeenCalled();
    expect(child.getState().a).toBe(10);
  });

  it('keeps the shadowed value when the parent changes a key the child owns', () => {
    const parent = createStore<S>({ a: 1, b: 2 });
    const child = createStore<S>({ a: 100, c: 9 }, { parent });

    parent.setState('a', 10);

    // Child owns `a`, so its resolved value stays shadowed regardless of the parent change (consumer-level
    // equality turns the wake-up into a no-op).
    expect(child.getState().a).toBe(100);
  });

  it('unlinks from the parent on destroy', () => {
    const { parent, child } = makeChain();
    // A scoped store attaches to its parent lazily — only once it has a subscriber.
    const detached = (parent as StoreApiInternal<S>).listeners.length;
    const unsubscribe = child.subscribe(vi.fn());
    const attached = (parent as StoreApiInternal<S>).listeners.length;

    expect(attached).toBe(detached + 1);

    unsubscribe();
    child.destroy?.();

    expect((parent as StoreApiInternal<S>).listeners.length).toBe(detached);

    const listener = vi.fn();
    child.subscribe(listener); // does not revive a destroyed scope (only reconnect does)
    parent.setState('a', 123);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('scoped store: StoreProvider inherit modes', () => {
  const { useStore } = createStoreHook<S>();

  type InnerProps = { value: Partial<S>; inherit?: 'snapshot' | 'live' };

  const makeWrapper = (innerProps: InnerProps, onParent: (store: StoreApi<S>) => void = () => {}) => {
    const Capture = ({ children }: { children: ReactNode }) => {
      onParent(useContext(StoreContext) as StoreApi<S>);

      return children;
    };

    return ({ children }: { children: ReactNode }) =>
      createElement(
        StoreProvider<S>,
        { value: { a: 1, b: 2 } },
        createElement(Capture, null, createElement(StoreProvider<S>, innerProps, children))
      );
  };

  it('inherit="live": reads parent values through the chain', () => {
    const { result } = renderHook(() => useStore(['a', 'c'] as const), {
      wrapper: makeWrapper({ inherit: 'live', value: { c: 9 } })
    });

    expect(result.current[0]).toEqual([1, 9]); // a inherited live, c own
  });

  it('inherit="live": re-renders the consumer when the parent updates an inherited key', () => {
    let parentStore!: StoreApi<S>;
    const { result } = renderHook(() => useStore('a'), {
      wrapper: makeWrapper({ inherit: 'live', value: { c: 9 } }, store => {
        parentStore = store;
      })
    });

    expect(result.current[0]).toBe(1);

    act(() => parentStore.setState('a', 42));

    expect(result.current[0]).toBe(42);
  });

  it('inherit="snapshot": copies parent at init and stays isolated from later parent updates', () => {
    let parentStore!: StoreApi<S>;
    const { result } = renderHook(() => useStore('a'), {
      wrapper: makeWrapper({ inherit: 'snapshot', value: { c: 9 } }, store => {
        parentStore = store;
      })
    });

    expect(result.current[0]).toBe(1); // copied from parent

    act(() => parentStore.setState('a', 99));

    expect(result.current[0]).toBe(1); // isolated — parent update does NOT propagate
  });
});

describe('scoped store — change forwarding', () => {
  it('forwards a parent change with a prev distinct from next, reflecting the merged state', () => {
    const parent = createStore<S>({ a: 1, b: 2, c: 3 });
    const child = createStore<S>({ c: 9 }, { parent });

    const changes: StoreChange<S>[] = [];
    child.subscribeChange(change => changes.push(change));

    parent.setState('a', 42);

    expect(changes).toHaveLength(1);
    const last = changes[0];
    expect(last.prev).not.toBe(last.next);
    expect(last.prev.a).toBe(1); // pre-change merged state
    expect(last.next.a).toBe(42); // post-change merged state
    expect(last.next.c).toBe(9); // child's own key still shadows in the merged next
  });

  it('keeps a child-owned key local when writing undefined (no leak to parent)', () => {
    type T = { count: number; user: { name: string | undefined; age: number } };
    const parent = createStore<T>({ count: 0, user: { name: 'Ada', age: 36 } });
    const child = createStore<T>({ count: 100, user: { name: undefined, age: 0 } }, { parent });

    child.setState('user.name', undefined as never);

    expect(child.getState().user.name).toBeUndefined();
    expect(parent.getState().user.name).toBe('Ada');
  });
});
