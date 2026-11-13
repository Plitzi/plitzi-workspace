import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import useStateChanges from './useStateChanges';

/** A state as the store holds one: any keys. */
const page = (state: Record<string, unknown>) => ({ state });

describe('useStateChanges', () => {
  it('lists each key the state changes, newest first, and the last change of each', () => {
    const { result, rerender } = renderHook(({ state }) => useStateChanges(state), {
      initialProps: page({ step: 1, open: false })
    });

    rerender({ state: { step: 2, open: false } });
    rerender({ state: { step: 2, open: true, cart: [1] } });

    expect(result.current.changes.map(change => [change.path, change.from, change.to])).toEqual([
      ['cart', undefined, [1]],
      ['open', false, true],
      ['step', 1, 2]
    ]);
    expect(result.current.lastOf.get('step')?.to).toBe(2);
  });

  it('names the path under a key that changed, and its last change on every path above it', () => {
    const { result, rerender } = renderHook(({ state }) => useStateChanges(state), {
      initialProps: page({ cart: { items: [{ name: 'tea' }], total: 2 } })
    });

    rerender({ state: { cart: { items: [{ name: 'tea' }], total: 3 } } });
    rerender({ state: { cart: { items: [{ name: 'coffee' }], total: 3 } } });

    expect(result.current.changes.map(change => [change.path, change.from, change.to])).toEqual([
      ['cart.items.0.name', 'tea', 'coffee'],
      ['cart.total', 2, 3]
    ]);
    expect(result.current.lastOf.get('cart')?.path).toBe('cart.items.0.name');
    expect(result.current.lastOf.get('cart.total')?.to).toBe(3);
  });

  it('says a list replaced whole as one change of its key', () => {
    const { result, rerender } = renderHook(({ state }) => useStateChanges(state), {
      initialProps: page({ rows: [1, 2, 3, 4, 5] })
    });

    rerender({ state: { rows: [6, 7, 8, 9, 10] } });

    expect(result.current.changes.map(change => change.path)).toEqual(['rows']);
  });

  it('says nothing of a state rewritten with the same values, and forgets on clear', () => {
    const { result, rerender } = renderHook(({ state }) => useStateChanges(state), {
      initialProps: page({ list: [1, 2] })
    });

    rerender({ state: { list: [1, 2] } });
    expect(result.current.changes).toEqual([]);

    rerender({ state: { list: [1] } });
    act(() => result.current.clear());
    expect(result.current.changes).toEqual([]);
  });
});
