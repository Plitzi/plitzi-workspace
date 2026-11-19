import { expect, it } from 'vitest';

import { describeResumeWaiting } from './jobQueueResumeContract';

import type { JobQueue } from '../../../types';
import type { JobInput } from '@plitzi/sdk-shared';

/** What this half of the job queue contract reads of the contract around it. */
export type DropWaitingSubject = {
  queue: () => JobQueue;
  job: (over?: Partial<JobInput>) => Promise<JobInput>;
  space: number;
  otherSpace: number;
};

/**
 * A queue emptied at once (`cancelWaiting`), run inside `describeJobQueue` against each store: a schedule whose every
 * run was set aside leaves a job a minute, and an operator drops them in one go — never what runs or has ended — or, its
 * cause fixed, puts them all back (`describeResumeWaiting`).
 */
export const describeDropWaiting = (ctx: DropWaitingSubject): void => {
  describeResumeWaiting(ctx);

  it('drops at once what has not started — all of it, or one status, kind and name — and leaves the rest', async () => {
    const queue = ctx.queue();
    const sweep = (id: string, over: Partial<JobInput> = {}) =>
      ctx.job({ id, target: { kind: 'action', name: 'sweep', trigger: 'schedule' }, ...over });
    const train = (id: string, dueAt: number) => ctx.job({ id, dueAt, target: { kind: 'function', name: 'train' } });
    const setAside = async (id: string) => {
      await queue.enqueue(await sweep(id));
      await queue.claim({ workerId: 'pod-a', leaseMs: 60_000, limit: 1 });
      await queue.settle({
        jobId: id,
        workerId: 'pod-a',
        status: 'paused',
        error: 'Went over its 32 MB of memory',
        attempt: { status: 'failed', workerId: 'pod-a', error: 'Went over its 32 MB of memory' }
      });
    };
    await setAside('aside-1');
    await setAside('aside-2');
    await queue.enqueue(await sweep('done'));
    await queue.claim({ workerId: 'pod-a', leaseMs: 60_000, limit: 1 });
    await queue.settle({
      jobId: 'done',
      workerId: 'pod-a',
      status: 'succeeded',
      attempt: { status: 'succeeded', workerId: 'pod-a' }
    });
    await queue.enqueue(await sweep('running'));
    await queue.claim({ workerId: 'pod-a', leaseMs: 60_000, limit: 1 });
    const later = (await queue.now()).getTime() + 60_000;
    await queue.enqueue(await sweep('waiting', { dueAt: later }));
    await queue.enqueue(await ctx.job({ id: 'digest', dueAt: later }));
    await queue.enqueue(await train('train-waiting', later));
    await queue.enqueue(await train('train-aside', later));
    await queue.pause([ctx.space], 'train-aside');
    await queue.enqueue(await sweep('theirs', { spaceId: ctx.otherSpace, dueAt: later }));

    const statusOf = async (id: string, space = ctx.space) => (await queue.getJob([space], id))?.status;

    expect(
      await queue.cancelWaiting({ spaceIds: [ctx.space], status: 'paused', kind: 'action', name: 'sweep' })
    ).toEqual({ cancelled: 2, functionJobs: [] });
    expect(await statusOf('aside-1')).toBe('cancelled');
    expect(await statusOf('aside-2')).toBe('cancelled');
    expect(await statusOf('waiting')).toBe('pending');
    expect(await statusOf('train-aside')).toBe('paused');

    const rest = await queue.cancelWaiting({ spaceIds: [ctx.space] });
    expect(rest.cancelled).toBe(4);
    expect([...rest.functionJobs].sort()).toEqual(['train-aside', 'train-waiting']);
    expect(await statusOf('waiting')).toBe('cancelled');
    expect(await statusOf('digest')).toBe('cancelled');
    expect(await statusOf('train-waiting')).toBe('cancelled');
    expect(await statusOf('train-aside')).toBe('cancelled');
    expect(await statusOf('running')).toBe('running');
    expect(await statusOf('done')).toBe('succeeded');
    expect(await statusOf('theirs', ctx.otherSpace)).toBe('pending');

    expect(await queue.cancelWaiting({ spaceIds: [ctx.space] })).toEqual({ cancelled: 0, functionJobs: [] });
    expect(await queue.cancelWaiting({ spaceIds: [] })).toEqual({ cancelled: 0, functionJobs: [] });
  });
};
