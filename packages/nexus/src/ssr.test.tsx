import { renderHook, act } from '@testing-library/react';
import { createElement, useContext } from 'react';
import { describe, it, expect } from 'vitest';

import StoreProvider, { StoreContext } from './react/StoreProvider';
import { createServerSnapshot } from './rsc';

import type { StoreApi } from './types';
import type { ReactNode } from 'react';

type S = { count: number; user: string };

const useStoreApi = () => useContext(StoreContext) as StoreApi<S>;

describe('SSR → Client transition', () => {
  it('strips the SSR flag from a createServerSnapshot value', () => {
    const serverData = createServerSnapshot({ count: 42, user: 'Alice' });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(StoreProvider<S>, { value: serverData, autoSync: false }, children);

    const { result } = renderHook(useStoreApi, { wrapper });

    // The store has the data from the server
    expect(result.current.getState().count).toBe(42);
    expect(result.current.getState().user).toBe('Alice');
  });

  it('works without createServerSnapshot (plain value)', () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(StoreProvider<S>, { value: { count: 10, user: 'Bob' }, autoSync: false }, children);

    const { result } = renderHook(useStoreApi, { wrapper });

    expect(result.current.getState().count).toBe(10);
    expect(result.current.getState().user).toBe('Bob');
  });

  it('works with a function value on StoreProvider', () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(StoreProvider<S>, { value: () => ({ count: 1, user: 'from-fn' }), autoSync: false }, children);

    const { result } = renderHook(useStoreApi, { wrapper });

    expect(result.current.getState().count).toBe(1);
    expect(result.current.getState().user).toBe('from-fn');
  });

  it('a nested snapshot value is stripped by the provider', () => {
    // Simulates SSR: a parent hands a snapshot, a nested client provider inherits
    const parentData = createServerSnapshot({ count: 100, user: 'server' });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        StoreProvider<S>,
        { value: parentData, autoSync: false, id: 'ssr-root' },
        createElement(StoreProvider<S>, { value: { user: 'client' }, inherit: 'snapshot', autoSync: false }, children)
      );

    const { result } = renderHook(useStoreApi, { wrapper });

    // The inner provider copies parent state at init (inherit='snapshot')
    expect(result.current.getState().count).toBe(100);
    expect(result.current.getState().user).toBe('client');
  });

  it('StoreProvider with snapshot + writes works normally', () => {
    const serverData = createServerSnapshot({ count: 0, user: 'server' });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(StoreProvider<S>, { value: serverData, autoSync: false }, children);

    const { result } = renderHook(useStoreApi, { wrapper });

    act(() => {
      result.current.setState('count', 5);
    });

    expect(result.current.getState().count).toBe(5);
  });
});
