import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import useGraphQL from '@pmodules/Network/hooks/useGraphQL';
import QueueStatusContext from '@pmodules/Queue/QueueStatusContext';

import useSpaceIssues from './useSpaceIssues';

import type { TSpaceIssues } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

vi.mock('@pmodules/Network/hooks/useGraphQL', () => ({ default: vi.fn() }));

const issues: TSpaceIssues = {
  errors: [{ code: 'binding-target-unknown', message: 'Lands on nothing', elementId: 'hello' }],
  warnings: []
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
  it('asks again once the save queue drains, and not before', () => {
    const { rerender } = mount(true);
    expect(mutate).not.toHaveBeenCalled();

    settle(true, rerender);
    expect(mutate).not.toHaveBeenCalled();

    settle(false, rerender);
    expect(mutate).toHaveBeenCalledTimes(1);

    settle(false, rerender);
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('hands a caller that has to decide the fresh list', async () => {
    const { result } = mount(false);

    await expect(result.current.refresh()).resolves.toEqual(issues);
  });
});
