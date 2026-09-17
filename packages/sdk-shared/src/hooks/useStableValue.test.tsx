import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import useStableValue from './useStableValue';

describe('useStableValue', () => {
  it('keeps the first reference while the content does not change', () => {
    const first = { slug: 'a', page: { id: 1 } };
    const { result, rerender } = renderHook(({ value }) => useStableValue(value), { initialProps: { value: first } });

    rerender({ value: { slug: 'a', page: { id: 1 } } });

    expect(result.current).toBe(first);
  });

  it('hands over the new value once the content changes', () => {
    const { result, rerender } = renderHook(({ value }) => useStableValue(value), {
      initialProps: { value: { slug: 'a' } }
    });
    const next = { slug: 'b' };

    rerender({ value: next });

    expect(result.current).toBe(next);
  });
});
