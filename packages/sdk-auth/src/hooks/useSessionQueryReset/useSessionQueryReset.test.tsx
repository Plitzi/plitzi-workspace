import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import useSessionQueryReset from './useSessionQueryReset';

const reset = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('@plitzi/sdk-shared/queries', () => ({ queryCache: { reset } }));

beforeEach(() => {
  reset.mockClear();
});

describe('useSessionQueryReset', () => {
  it('keeps the cache for the visitor the page started with', () => {
    const { rerender } = renderHook(({ identity }) => useSessionQueryReset(identity), {
      initialProps: { identity: '7' }
    });
    rerender({ identity: '7' });

    expect(reset).not.toHaveBeenCalled();
  });

  it('forgets it on a sign-in, a sign-out and a change of account', () => {
    const { rerender } = renderHook(({ identity }) => useSessionQueryReset(identity), {
      initialProps: { identity: '' }
    });

    rerender({ identity: '7' });
    rerender({ identity: '9' });
    rerender({ identity: '' });

    expect(reset).toHaveBeenCalledTimes(3);
  });
});
