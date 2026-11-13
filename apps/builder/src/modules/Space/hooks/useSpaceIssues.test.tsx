import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import useGraphQL from '@pmodules/Network/hooks/useGraphQL';
import QueueStatusContext from '@pmodules/Queue/QueueStatusContext';

import useSpaceIssues, { QUIET_MS } from './useSpaceIssues';

import type { TSpaceIssues } from '@plitzi/sdk-shared/network';
import type { ReactNode } from 'react';

vi.mock('@pmodules/Network/hooks/useGraphQL', () => ({ default: vi.fn() }));

const issues: TSpaceIssues = {
  errors: [
    { code: 'binding-target-unknown', message: 'Lands on nothing', elementId: 'hello', fixable: false, fix: null }
  ],
  warnings: [],
  suggestions: []
};

const mutate = vi.fn(() => Promise.resolve({ SpaceIssues: issues }));

/** The hook as the builder mounts it, under a save queue whose state the test moves with `queue.busy`. */
const queue = { busy: false };

const mount = (busy: boolean) => {
  queue.busy = busy;

  return renderHook(() => useSpaceIssues(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueueStatusContext value={queue.busy}>{children}</QueueStatusContext>
    )
  });
};

const settle = (busy: boolean, rerender: () => void) => {
  queue.busy = busy;
  rerender();
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useGraphQL).mockReturnValue({
    data: { SpaceIssues: issues },
    error: undefined,
    isLoading: false,
    mutate
  });
});

describe('useSpaceIssues', () => {
  it('reads the saved space, main environment', () => {
    const { result } = mount(false);

    expect(result.current.issues).toEqual(issues);
    expect(vi.mocked(useGraphQL)).toHaveBeenCalledWith(
      'SpaceIssues',
      undefined,
      { environment: 'main' },
      expect.anything()
    );
  });

  // The server reads what it holds, so asking while a save is queued answers for a space the builder has moved past.
  it('asks again once the save queue drains and stays so a moment, and not before', () => {
    vi.useFakeTimers();
    const { rerender } = mount(true);
    expect(mutate).not.toHaveBeenCalled();

    settle(true, rerender);
    settle(false, rerender);
    expect(mutate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(QUIET_MS);
    expect(mutate).toHaveBeenCalledTimes(1);

    settle(false, rerender);
    vi.advanceTimersByTime(QUIET_MS);
    expect(mutate).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  // Each save of an edit drains the queue: the list was asked for after every one, the whole space read each time.
  it('asks once for a run of saves, after the last', () => {
    vi.useFakeTimers();
    const { rerender } = mount(true);
    for (let save = 0; save < 5; save++) {
      settle(false, rerender);
      vi.advanceTimersByTime(QUIET_MS / 3);
      settle(true, rerender);
    }

    settle(false, rerender);
    vi.advanceTimersByTime(QUIET_MS);
    expect(mutate).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('hands a caller that has to decide the fresh list', async () => {
    const { result } = mount(false);

    await expect(result.current.refresh()).resolves.toEqual(issues);
  });
});
