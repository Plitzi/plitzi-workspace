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

    expect(result.current.changes.map(change => [change.key, change.from, change.to])).toEqual([
      ['cart', undefined, [1]],
      ['open', false, true],
      ['step', 1, 2]
    ]);
    expect(result.current.lastOf.get('step')?.to).toBe(2);
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
