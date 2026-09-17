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

  it('asks again as the new person, and as nobody asks nothing', () => {
    // A sign-out has no session to ask with: every provider still on screen answered 401, and each refusal is
    // reported as a session that ended.
    const { rerender } = renderHook(({ identity }) => useSessionQueryReset(identity), {
      initialProps: { identity: '' }
    });

    rerender({ identity: '7' });
    expect(reset).toHaveBeenLastCalledWith({ refetch: true });

    rerender({ identity: '' });
    expect(reset).toHaveBeenLastCalledWith({ refetch: false });
  });
});
