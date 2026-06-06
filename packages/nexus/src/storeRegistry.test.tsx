import { renderHook, render, act } from '@testing-library/react';
import { createElement, useContext } from 'react';
import { describe, it, expect, vi } from 'vitest';

import { createStoreHook } from './createStore';
import useStoreById from './createStore/hooks/useStoreById';
import { findStoreInRegistry, StoreRegistryContext } from './StoreContext';
import StoreProvider from './StoreProvider';

import type { ReactNode } from 'react';

type S = { a: number; b: number };

const { useStore } = createStoreHook<S>();

// A named root store, then a DISCONNECTED provider (no `inherit`) in between, then the consumer. The disconnected
// provider shadows the nearest store, so without the registry the consumer could not reach the root.
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(
    StoreProvider<S>,
    { id: 'root', value: { a: 1 } },
    createElement(StoreProvider<S>, { value: { b: 2 } }, children)
  );

describe('store registry: reach an ancestor store by id across a disconnected provider', () => {
  it('reads the named ancestor via storeId, and the nearest store otherwise', () => {
    const { result } = renderHook(() => ({ rootA: useStore('a', { storeId: 'root' })[0], innerB: useStore('b')[0] }), {
      wrapper
    });

    expect(result.current.rootA).toBe(1);
    expect(result.current.innerB).toBe(2);
  });

  it('the nearest (disconnected) store cannot see the root key', () => {
    const { result } = renderHook(() => useStore('a', { defaultValue: -1 })[0], { wrapper });

    expect(result.current).toBe(-1);
  });

  it('reacts to updates written to the ancestor store reached by id', () => {
    const { result } = renderHook(() => useStore('a', { storeId: 'root' }), { wrapper });

    expect(result.current[0]).toBe(1);
    act(() => result.current[1](5));
    expect(result.current[0]).toBe(5);
  });

  it('useStoreById returns the raw named ancestor store', () => {
    const { result } = renderHook(() => useStoreById<S>('root'), { wrapper });

    expect(result.current.id).toBe('root');
    expect(result.current.getPath('a')).toBe(1);
  });

  it('throws for an id no ancestor registered', () => {
    expect(() => renderHook(() => useStoreById('missing'), { wrapper })).toThrow(
      /no store registered with id "missing"/
    );
  });

  it('warns (dev) when an id shadows an ancestor with the same id', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const dupWrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        StoreProvider<S>,
        { id: 'dup', value: { a: 1 } },
        createElement(StoreProvider<S>, { id: 'dup', value: { b: 2 } }, children)
      );

    renderHook(() => useStoreById<S>('dup'), { wrapper: dupWrapper });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('duplicate StoreProvider id "dup"'));
    warn.mockRestore();
  });

  it('does not warn when ids are unique', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderHook(() => useStoreById<S>('root'), { wrapper });

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('drops the registration when the provider unmounts (context-scoped, no manual cleanup)', () => {
    const seen: Array<string | null> = [];
    const Probe = () => {
      const registry = useContext(StoreRegistryContext);
      seen.push(findStoreInRegistry(registry, 'ephemeral')?.id ?? null);

      return null;
    };

    const { rerender } = render(
      createElement(StoreProvider<S>, { id: 'ephemeral', value: { a: 1 } }, createElement(Probe))
    );
    expect(seen.at(-1)).toBe('ephemeral'); // reachable while mounted

    rerender(createElement(Probe)); // provider unmounts; Probe is now at the root
    expect(seen.at(-1)).toBe(null); // gone — React tore the context value down
  });
});
