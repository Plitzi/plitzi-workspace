import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NetworkContext } from '@plitzi/sdk-shared/network';

import useServerPlay from './useServerPlay';

import type { NetworkContextValue } from '@plitzi/sdk-shared/network';
import type { ReactNode } from 'react';

/** The hook on a space channel of its own, and a way to deliver what the server publishes on it. */
const renderPlay = () => {
  const handlers = new Map<string, (payload: unknown) => void>();
  const subscriptionManager = {
    subscribe: (event: string, callback: (payload: unknown) => void) => {
      handlers.set(event, callback);

      return () => handlers.delete(event);
    }
  };
  // The network as far as the hook reads it: the one channel it listens on.
  const network = { subscriptionManager } as unknown as NetworkContextValue;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NetworkContext value={network}>{children}</NetworkContext>
  );
  const view = renderHook(() => useServerPlay(), { wrapper });
  const deliver = (payload: object) => {
    act(() => handlers.get('SPACE_TESTS_PLAYING')?.({ run: 'r1', of: 2, steps: 2, ...payload }));
  };

  return { view, deliver };
};

describe('a play heard from the server', () => {
  it('follows each journey step by step, keeps the last picture, and ends with the run’s last journey', () => {
    const { view, deliver } = renderPlay();
    deliver({ test: 'a', at: 0, played: 1, ok: true, frame: 'data:a1' });
    expect(view.result.current.play).toMatchObject({
      journeys: { a: { state: 'playing', played: 1 } },
      now: { test: 'a', played: 1, frame: 'data:a1' },
      ended: false
    });

    deliver({ test: 'a', at: 0, played: 2, ok: false, ended: true });
    deliver({ test: 'b', at: 1, played: 2, ok: true, ended: true });
    expect(view.result.current.play).toMatchObject({
      journeys: { a: { state: 'failed' }, b: { state: 'passed' } },
      ended: true
    });
    expect(view.result.current.play?.now.frame).toBeUndefined();
  });

  it('starts over for a new run, and is settled by the run’s answer or by a long silence', () => {
    vi.useFakeTimers();
    try {
      const { view, deliver } = renderPlay();
      deliver({ test: 'a', at: 0, played: 1, ok: true });
      deliver({ run: 'r2', test: 'b', at: 0, played: 1, ok: true });
      expect(Object.keys(view.result.current.play?.journeys ?? {})).toEqual(['b']);

      act(() => view.result.current.settle());
      expect(view.result.current.play?.ended).toBe(true);

      deliver({ run: 'r3', test: 'c', at: 0, played: 1, ok: true });
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(view.result.current.play?.ended).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
