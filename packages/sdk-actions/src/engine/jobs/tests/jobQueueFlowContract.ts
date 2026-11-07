import { expect, it } from 'vitest';

import type { JobQueue } from '../../../types';
import type { JobInput } from '@plitzi/sdk-shared';

/** What the flow half of the job queue contract reads of the contract around it. */
export type FlowSubject = {
  queue: () => JobQueue;
  job: (over?: Partial<JobInput>) => Promise<JobInput>;
};

/**
 * The job queue contract's flow (`flow`), run inside `describeJobQueue` against each store: what tells a queue that
 * keeps up from one that falls behind — what fell due, was started and ended each minute, and how long it waited.
 */
export const describeFlow = (ctx: FlowSubject): void => {
  it('counts its flow minute by minute: what fell due, was started and ended, and how long it waited', async () => {
    const queue = ctx.queue();
    const at = (await queue.now()).getTime();
    await queue.enqueue(await ctx.job({ id: 'done', dueAt: at - 2_000 }));
    await queue.enqueue(await ctx.job({ id: 'running', dueAt: at - 2_000 }));
    await queue.enqueue(await ctx.job({ id: 'later', dueAt: at + 3_600_000 }));
    const [first] = await queue.claim({ workerId: 'pod-a', leaseMs: 60_000, limit: 2 });
    await queue.settle({
      jobId: first.id,
      workerId: 'pod-a',
      status: 'succeeded',
      attempt: { status: 'succeeded', workerId: 'pod-a' }
    });

    const until = (await queue.now()).getTime() + 1;
    const flow = await queue.flow({ from: at - 120_000, to: until });
    const sum = (field: 'due' | 'started' | 'ended') => flow.reduce((total, minute) => total + minute[field], 0);

    expect([sum('due'), sum('started'), sum('ended')]).toEqual([2, 2, 1]);
    const waits = flow.flatMap(minute => (minute.waitP95Ms === undefined ? [] : [minute.waitP95Ms]));
    expect(Math.max(...waits)).toBeGreaterThanOrEqual(2_000);
    expect(flow.at(-1)?.minute).toBe(Math.floor((until - 1) / 60_000));
  });

  // An operator's view across spaces: what waits the longest first, what runs, what just ended.
  it('lists the jobs of every space in some statuses, the longest due or the latest written first', async () => {
    const queue = ctx.queue();
    const at = (await queue.now()).getTime();
    await queue.enqueue(await ctx.job({ id: 'newer', dueAt: at - 1_000 }));
    await queue.enqueue(await ctx.job({ id: 'older', dueAt: at - 5_000, spaceId: 7_999 }));
    await queue.enqueue(await ctx.job({ id: 'later', dueAt: at + 60_000 }));

    const waiting = await queue.listAcross({ statuses: ['pending'], limit: 10, order: 'due' });
    expect(waiting.map(job => job.id)).toEqual(['older', 'newer', 'later']);
    expect(await queue.listAcross({ statuses: ['pending'], limit: 1, order: 'due' })).toHaveLength(1);
    expect(await queue.listAcross({ statuses: ['running'], limit: 10, order: 'latest' })).toEqual([]);
  });
};
