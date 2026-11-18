import { describe, expect, it, vi } from 'vitest';

import { heldAtLimit, limitEndings, limitSetAsideError } from './endings';

import type { JobSettlement } from '../../types';
import type { Job } from '@plitzi/sdk-shared';

const job = (over: Partial<Job> = {}): Job => ({
  id: 'schedule:1:sweep:0',
  spaceId: 1,
  environment: 'main',
  target: { kind: 'action', name: 'sweep', trigger: 'schedule' },
  input: {},
  status: 'running',
  attempts: 1,
  maxAttempts: 3,
  dueAt: 0,
  runAt: 0,
  createdAt: 0,
  updatedAt: 0,
  history: [],
  ...over
});

describe('a job stopped at a limit', () => {
  it('is set aside at once, its attempt saying which limit', async () => {
    const settled: JobSettlement[] = [];
    const ended = limitEndings({
      workerId: 'pod-a',
      settle: settlement => {
        settled.push(settlement);

        return Promise.resolve();
      },
      release: vi.fn(),
      nextMinuteMs: () => Promise.resolve(1000)
    });

    expect(await ended(job(), 'run-1', 'memory', 'Went over its 32 MB of memory')).toBe(true);
    expect(settled).toEqual([
      {
        jobId: 'schedule:1:sweep:0',
        workerId: 'pod-a',
        status: 'paused',
        runId: 'run-1',
        error: limitSetAsideError('Went over its 32 MB of memory'),
        attempt: {
          status: 'failed',
          workerId: 'pod-a',
          runId: 'run-1',
          error: 'Went over its 32 MB of memory',
          limit: 'memory'
        }
      }
    ]);
    // Its time is not one: an API slow for a minute answers the next attempt.
    expect(await ended(job(), 'run-2', 'time', 'Took too long')).toBe(false);
  });
});

describe('heldAtLimit', () => {
  const attempt = { attempt: 1, status: 'failed' as const, startedAt: 0, endedAt: 1, workerId: 'pod-a' };

  it('is the limit a job set aside was stopped at, when its code meets it again', () => {
    for (const limit of ['memory', 'cpu', 'calls', 'output', 'steps', 'requests', 'response'] as const) {
      expect(heldAtLimit(job({ status: 'paused', history: [{ ...attempt, limit }] }))).toBe(limit);
    }
  });

  it('is nothing for an allowance spent, a job that failed every attempt, or one no longer set aside', () => {
    expect(heldAtLimit(job({ status: 'paused', history: [{ ...attempt, limit: 'quota' }] }))).toBeUndefined();
    expect(
      heldAtLimit(job({ status: 'paused', history: [{ ...attempt, error: 'the API answered 503' }] }))
    ).toBeUndefined();
    expect(heldAtLimit(job({ status: 'pending', history: [{ ...attempt, limit: 'memory' }] }))).toBeUndefined();
    expect(heldAtLimit(job({ status: 'paused', history: [] }))).toBeUndefined();
    // The last attempt is the one it waits on: an earlier one at a limit, resumed since, says nothing.
    expect(heldAtLimit(job({ status: 'paused', history: [{ ...attempt, limit: 'memory' }, attempt] }))).toBeUndefined();
  });
});
