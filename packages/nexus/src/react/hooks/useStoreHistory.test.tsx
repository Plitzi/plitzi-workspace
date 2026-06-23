import { renderHook, act } from '@testing-library/react';
import { createElement } from 'react';
import { describe, it, expect, vi } from 'vitest';

import { useStoreHistory } from './useStoreHistory';
import createStore from '../../createStore/createStore';
import { historyMiddleware } from '../../middleware/historyMiddleware';
import { StoreContext } from '../StoreProvider';

import type { StoreApi } from '../../types';
import type { ReactNode } from 'react';

type S = { count: number };

const wrapper =
  (store: StoreApi<S>) =>
  ({ children }: { children: ReactNode }) =>
    createElement(StoreContext, { value: store }, children);

const makeStore = () => createStore<S>({ count: 0 }, { middlewares: [historyMiddleware<S>()] });

describe('useStoreHistory', () => {
  it('records changes and drives undo / redo reactively', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStoreHistory<S>(), { wrapper: wrapper(store) });

    expect(result.current.canUndo).toBe(false);

    act(() => store.setState('count', 1));
    act(() => store.setState('count', 2));

    expect(result.current.entries.length).toBe(3);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(store.getState().count).toBe(1);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(store.getState().count).toBe(2);
  });

  it('jumps to any snapshot with travelTo and resets with clear', () => {
    const store = makeStore();
    const { result } = renderHook(() => useStoreHistory<S>(), { wrapper: wrapper(store) });

    act(() => store.setState('count', 1));
    act(() => store.setState('count', 2));
    act(() => result.current.travelTo(0));

    expect(store.getState().count).toBe(0);

    act(() => result.current.clear());
    expect(result.current.entries.length).toBe(1);
    expect(result.current.canUndo).toBe(false);
  });

  it('returns an empty, no-op view and warns when no historyMiddleware is attached', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = createStore<S>({ count: 0 });
    const { result } = renderHook(() => useStoreHistory<S>(), { wrapper: wrapper(store) });

    act(() => store.setState('count', 1));

    expect(result.current.entries).toHaveLength(0);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(() => result.current.undo()).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('historyMiddleware'));

    warn.mockRestore();
  });
});
