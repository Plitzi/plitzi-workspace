import { renderHook, act } from '@testing-library/react';
import { createElement } from 'react';
import { describe, it, expect } from 'vitest';

import useStoreSetter from './useStoreSetter';
import createStore from '../../createStore';
import { StoreContext } from '../StoreProvider';

import type { StoreApi } from '../../types';
import type { ReactNode } from 'react';

type S = { count: number; user: { name: string; age: number } };

const makeStore = () => createStore<S>({ count: 0, user: { name: 'Ada', age: 36 } });

const wrapper =
  (store: StoreApi<S>) =>
  ({ children }: { children: ReactNode }) =>
    createElement(StoreContext, { value: store }, children);

describe('useStoreSetter', () => {
  it('returns a full setter that writes a path and accepts an updater', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStoreSetter<S>(), { wrapper: wrapper(store) });

    act(() => result.current('count', 1));
    expect(store.getState().count).toBe(1);

    act(() => result.current('count', n => n + 9));
    expect(store.getState().count).toBe(10);
  });

  it('replaces the whole state through the full setter', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStoreSetter<S>(), { wrapper: wrapper(store) });

    act(() => result.current(undefined, { count: 5, user: { name: 'Grace', age: 85 } }));
    expect(store.getState()).toEqual({ count: 5, user: { name: 'Grace', age: 85 } });
  });

  it('scopes a base-path setter for sub-paths and the base itself', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStoreSetter<S, 'user'>('user'), { wrapper: wrapper(store) });

    act(() => result.current('name', 'Bob'));
    expect(store.getState().user.name).toBe('Bob');

    act(() => result.current(undefined, { name: 'Carol', age: 40 }));
    expect(store.getState().user).toEqual({ name: 'Carol', age: 40 });
  });

  it('keeps a stable setter reference across re-renders', () => {
    const store = makeStore();
    const { result, rerender } = renderHook(() => useStoreSetter<S>(), { wrapper: wrapper(store) });
    const first = result.current;
    rerender();

    expect(result.current).toBe(first);
  });

  it('prefers an explicit store option over context', () => {
    const optionStore = makeStore();
    const { result } = renderHook(() => useStoreSetter<S>({ store: optionStore }));

    act(() => result.current('count', 3));
    expect(optionStore.getState().count).toBe(3);
  });

  it('throws when used without a store', () => {
    expect(() => renderHook(() => useStoreSetter<S>())).toThrow(/StoreProvider/);
  });
});
