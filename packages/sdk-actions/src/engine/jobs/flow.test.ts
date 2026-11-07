import { describe, expect, it } from 'vitest';

import { flowOf } from './flow';

import type { FlowJob } from './flow';

const MINUTE = 60_000;
const T = 1_000 * MINUTE;

const job = (over: Partial<FlowJob>): FlowJob => ({
  dueAt: T,
  history: [],
  status: 'pending',
  updatedAt: T,
  attempts: 0,
  ...over
});

describe('flowOf', () => {
  it('counts each minute what fell due, was started and ended, and the wait of first attempts', () => {
    const flow = flowOf(
      [
        job({
          dueAt: T,
          status: 'succeeded',
          attempts: 2,
          history: [
            { attempt: 1, status: 'failed', startedAt: T + 10_000, endedAt: T + 20_000, workerId: 'w' },
            {
              attempt: 2,
              status: 'succeeded',
              startedAt: T + MINUTE + 5_000,
              endedAt: T + MINUTE + 6_000,
              workerId: 'w'
            }
          ]
        }),
        // Running now: its attempt started when it was claimed.
        job({ dueAt: T + 1_000, status: 'running', attempts: 1, updatedAt: T + 31_000 }),
        // Due before the span: its wait is counted where its attempt started.
        job({ dueAt: T - 5 * MINUTE, status: 'running', attempts: 1, updatedAt: T + MINUTE + 1_000 })
      ],
      T,
      T + 2 * MINUTE
    );

    expect(flow).toEqual([
      { minute: 1000, due: 2, started: 2, ended: 1, waitP95Ms: 30_000 },
      { minute: 1001, due: 0, started: 2, ended: 1, waitP95Ms: 6 * MINUTE + 1_000 }
    ]);
  });

  it('answers every minute of the span, quiet ones as zeros', () => {
    expect(flowOf([], T, T + 3 * MINUTE).map(minute => minute.due)).toEqual([0, 0, 0]);
  });
});
