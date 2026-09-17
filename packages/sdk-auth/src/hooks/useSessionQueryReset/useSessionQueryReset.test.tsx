import { render, renderHook } from '@testing-library/react';
import { useEffect } from 'react';
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

  it('forgets before anything below it asks', () => {
    // A sign-in mounts the account area in the same commit that changes who is looking, and a provider asks from an
    // ordinary effect. Forgetting after those ran duplicated every request the new page had just sent.
    const order: string[] = [];
    reset.mockImplementation(() => {
      order.push('forgets');

      return Promise.resolve();
    });

    const Provider = () => {
      useEffect(() => {
        order.push('asks');
      }, []);

      return null;
    };

    const Page = ({ identity }: { identity: string }) => {
      useSessionQueryReset(identity);

      return identity ? <Provider /> : null;
    };

    const { rerender } = render(<Page identity="" />);
    rerender(<Page identity="7" />);

    expect(order).toEqual(['forgets', 'asks']);
  });
});
