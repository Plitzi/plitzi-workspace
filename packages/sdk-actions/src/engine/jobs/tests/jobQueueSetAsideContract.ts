import { expect, it } from 'vitest';

import type { JobQueue } from '../../../types';
import type { JobInput } from '@plitzi/sdk-shared';

/** What the set-aside half of the job queue contract reads of the contract around it. */
export type SetAsideSubject = {
  queue: () => JobQueue;
  job: (over?: Partial<JobInput>) => Promise<JobInput>;
  space: number;
};

/**
 * A job that failed every attempt waits for somebody (`paused`), run inside `describeJobQueue` against each store:
 * resumed once fixed, it has every attempt again.
 */
export const describeSetAside = (ctx: SetAsideSubject): void => {
  it('sets a job that failed every attempt aside, and resumes it with every attempt again', async () => {
    await ctx.queue().enqueue(await ctx.job({ maxAttempts: 1 }));
    await ctx.queue().claim({ workerId: 'pod-a', leaseMs: 60_000, limit: 1 });
    await ctx.queue().settle({
      jobId: 'job-1',
      workerId: 'pod-a',
      status: 'paused',
      error: 'Set aside after 1 failed attempt',
      attempt: { status: 'failed', workerId: 'pod-a', error: 'the provider said no' }
    });

    expect(await ctx.queue().getJob([ctx.space], 'job-1')).toMatchObject({ status: 'paused', attempts: 1 });
    expect(await ctx.queue().claim({ workerId: 'pod-b', leaseMs: 60_000, limit: 1 })).toEqual([]);

    expect(await ctx.queue().resume([ctx.space], 'job-1')).toBe(true);
    expect(await ctx.queue().getJob([ctx.space], 'job-1')).toMatchObject({ status: 'pending', attempts: 0 });
    expect(await ctx.queue().claim({ workerId: 'pod-b', leaseMs: 60_000, limit: 1 })).toMatchObject([
      { id: 'job-1', attempts: 1, history: [{ status: 'failed', error: 'the provider said no' }] }
    ]);
  });
};
