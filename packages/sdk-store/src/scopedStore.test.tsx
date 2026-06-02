import { renderHook, act } from '@testing-library/react';
import { createElement, use } from 'react';
import { describe, it, expect, vi } from 'vitest';

import createStore, { createStoreHook } from './createStore';
import StoreProvider, { StoreContext } from './StoreProvider';

import type { StoreApi, StoreApiInternal } from './types';
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

  it('writes brand-new keys (owned by nobody) to the current scope', () => {
    const { parent, child } = makeChain();

    child.setState('z', 7);

    expect(child.getState().z).toBe(7);
    expect(parent.getState().z).toBeUndefined();
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

  it('does not wake a child path listener for a shadowed key', () => {
    const parent = createStore<S>({ a: 1, b: 2 });
    const child = createStore<S>({ a: 100, c: 9 }, { parent });
    const pathListener = vi.fn();
    child.subscribePath('a', pathListener);

    parent.setState('a', 10);

    expect(pathListener).not.toHaveBeenCalled();
    expect(child.getState().a).toBe(100); // still shadowed
  });

  it('unlinks from the parent on destroy', () => {
    const { parent, child } = makeChain();
    const before = (parent as StoreApiInternal<S>).listeners.size;

    child.destroy?.();

    expect((parent as StoreApiInternal<S>).listeners.size).toBe(before - 1);

    const listener = vi.fn();
    child.subscribe(listener);
    parent.setState('a', 123);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('scoped store: StoreProvider inherit modes', () => {
  const { useStore } = createStoreHook<S>();

  type InnerProps = { value: Partial<S>; inherit?: 'snapshot' | 'live' };

  const makeWrapper = (innerProps: InnerProps, onParent: (store: StoreApi<S>) => void = () => {}) => {
    const Capture = ({ children }: { children: ReactNode }) => {
      onParent(use(StoreContext) as StoreApi<S>);

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
