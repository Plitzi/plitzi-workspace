import { expect, it } from 'vitest';

import type { ActionScheduleInput, JobQueue } from '../../../types';
import type { JobInput } from '@plitzi/sdk-shared';

/** What the set-aside half of the job queue contract reads of the contract around it. */
export type SetAsideSubject = {
  queue: () => JobQueue;
  job: (over?: Partial<JobInput>) => Promise<JobInput>;
  schedule: (over?: Partial<ActionScheduleInput>) => Promise<ActionScheduleInput>;
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

  // What a view narrowed to one environment reads: production's jobs apart from a builder's rehearsals in `main`.
  it('counts the jobs by status for each environment too, the one with the most first', async () => {
    const later = (await ctx.queue().now()).getTime() + 60_000;
    await ctx.queue().enqueue(await ctx.job({ id: 'p-1', environment: 'production', dueAt: later }));
    await ctx.queue().enqueue(await ctx.job({ id: 'p-2', environment: 'production', dueAt: later }));
    await ctx.queue().enqueue(await ctx.job({ id: 'm-1', environment: 'main' }));
    await ctx.queue().claim({ workerId: 'pod-a', leaseMs: 60_000, limit: 1 });

    const summary = await ctx.queue().summarize();

    expect(summary.byStatus).toMatchObject({ pending: 2, running: 1 });
    expect(summary.environments.map(each => each.environment)).toEqual(['production', 'main']);
    expect(summary.environments[0].byStatus).toMatchObject({ pending: 2, running: 0 });
    expect(summary.environments[1].byStatus).toMatchObject({ pending: 0, running: 1 });
    expect((await ctx.queue().summarize()).environments).toHaveLength(2);
  });

  // Counted as waiting, 32 jobs set aside at their limits read as a queue falling behind for minutes, with nothing to run.
  it('says a job set aside apart from what waits for the queue', async () => {
    await ctx.queue().enqueue(await ctx.job({ maxAttempts: 1 }));
    await ctx.queue().claim({ workerId: 'pod-a', leaseMs: 60_000, limit: 1 });
    await ctx.queue().settle({ jobId: 'job-1', workerId: 'pod-a', status: 'paused', error: 'Set aside at once' });

    const summary = await ctx.queue().summarize();

    expect(summary.byStatus.paused).toBe(1);
    expect(summary.waiting).toEqual({ calls: 0, schedules: 0, later: 0, functionJobs: 0, other: 0 });
    expect(summary.oldestDueAt).toBeUndefined();
    expect(summary.spaces).toEqual([]);
  });

  // A schedule waits on a fire set aside at a limit: the fires after it are held back, not made into jobs. It moves
  // on with the clock all the same, and the last fire that was a job stays the last — it names the one it waits on.
  it('moves a schedule on without a fire, keeping the last one that was', async () => {
    await ctx.queue().putSchedules({ spaceId: ctx.space, schedules: [await ctx.schedule()] });
    const [due] = await ctx.queue().dueSchedules(10);
    const moved = { spaceId: ctx.space, actionId: due.actionId, missed: 0 };
    await ctx.queue().advanceSchedule({ ...moved, from: due.nextRunAt, to: due.nextRunAt + 60_000 });

    expect(
      await ctx
        .queue()
        .advanceSchedule({ ...moved, from: due.nextRunAt + 60_000, to: due.nextRunAt + 120_000, held: true })
    ).toBe(true);
    const [after] = await ctx.queue().listSchedules([ctx.space]);

    expect(after).toMatchObject({ nextRunAt: due.nextRunAt + 120_000, lastFireAt: due.nextRunAt });
  });
};
