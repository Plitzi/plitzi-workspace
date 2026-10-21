// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import useRunSnapshot from './useRunSnapshot';

import type { RunSnapshot } from '@plitzi/sdk-shared/runs';

const snapshot: RunSnapshot = {
  runId: 'velada-copy',
  goal: 'A copy of the site',
  status: 'finished',
  done: 2,
  total: 2,
  at: '2026-10-21T10:00:00.000Z',
  tasks: [],
  attention: []
};

const answer = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useRunSnapshot', () => {
  it('asks nothing of a server that said it previews no run', () => {
    const fetched = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetched);

    const { result } = renderHook(() => useRunSnapshot(false));

    expect(result.current).toBeUndefined();
    expect(fetched).not.toHaveBeenCalled();
  });

  // Offered from the first run read, and kept: a finished run or a preview gone quiet leaves the last one read.
  it('is nothing until a run is read, then the last one read whatever is answered after', async () => {
    vi.useFakeTimers();
    const answers = [
      answer(404, { error: 'no snapshot yet' }),
      answer(200, snapshot),
      answer(404, { error: 'gone' }),
      answer(200, { not: 'a run' })
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() => Promise.resolve(answers.shift() ?? answer(404, {})))
    );

    const { result } = renderHook(() => useRunSnapshot(true));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current).toBeUndefined();

    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(result.current).toEqual(snapshot);

    await act(() => vi.advanceTimersByTimeAsync(6000));
    expect(result.current).toEqual(snapshot);
  });
});
