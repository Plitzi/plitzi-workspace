import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import createStore from '../../createStore/createStore';
import { createDerived } from '../createDerived';
import { useDerived } from './useDerived';

type S = { count: number; label: string };

describe('useDerived', () => {
  it('returns the computed value and re-renders only when it changes', () => {
    const store = createStore<S>({ count: 2, label: 'x' });
    const doubled = createDerived(store, ['count'], ([count]) => count * 2);

    const { result } = renderHook(() => useDerived(doubled));
    expect(result.current).toBe(4);

    act(() => store.setState('count', 5));
    expect(result.current).toBe(10);
  });

  it('does not change when an unrelated dependency changes', () => {
    const store = createStore<S>({ count: 2, label: 'x' });
    const doubled = createDerived(store, ['count'], ([count]) => count * 2);

    const { result } = renderHook(() => useDerived(doubled));
    const before = result.current;

    act(() => store.setState('label', 'y'));
    expect(result.current).toBe(before);
  });
});
