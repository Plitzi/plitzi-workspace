import { expect, it } from 'vitest';

import type { JobQueue } from '../../../types';
import type { JobInput } from '@plitzi/sdk-shared';

/** What this half of the job queue contract reads of the contract around it. */
export type ResumeWaitingSubject = {
  queue: () => JobQueue;
  job: (over?: Partial<JobInput>) => Promise<JobInput>;
  space: number;
  otherSpace: number;
};

/**
 * A group set aside put back at once (`resumeWaiting`), run inside `describeJobQueue` against each store: an operator
 * who fixed what set a schedule's runs aside resumes all of them, not the latest alone — and nothing else moves.
 */
export const describeResumeWaiting = (ctx: ResumeWaitingSubject): void => {
  it('puts back at once every job set aside of one kind and name — each with its attempts again — and nothing else', async () => {
    const queue = ctx.queue();
    const later = (await queue.now()).getTime() + 60_000;
    const sweep = (id: string, over: Partial<JobInput> = {}) =>
      ctx.job({ id, target: { kind: 'action', name: 'sweep', trigger: 'schedule' }, ...over });
    // Taken and set aside after its last attempt: resumed, it has every attempt again.
    const setAside = async (job: Promise<JobInput>) => {
      const input = await job;
      await queue.enqueue(input);
      await queue.claim({ workerId: 'pod-a', leaseMs: 60_000, limit: 1 });
      await queue.settle({
        jobId: input.id,
        workerId: 'pod-a',
        status: 'paused',
        error: 'Set aside after 1 failed attempt',
        attempt: { status: 'failed', workerId: 'pod-a', error: 'timeout' }
      });
    };
    await setAside(sweep('aside-1', { maxAttempts: 1 }));
    await setAside(sweep('aside-2', { maxAttempts: 1 }));
    await setAside(ctx.job({ id: 'digest-aside', maxAttempts: 1 }));
    await setAside(sweep('theirs', { spaceId: ctx.otherSpace, maxAttempts: 1 }));
    await queue.enqueue(await sweep('waiting', { dueAt: later }));
    await queue.enqueue(
      await ctx.job({ id: 'train-aside', dueAt: later, target: { kind: 'function', name: 'train' } })
    );
    await queue.pause([ctx.space], 'train-aside');

    const statusOf = async (id: string, space = ctx.space) => (await queue.getJob([space], id))?.status;

    expect(await queue.resumeWaiting({ spaceIds: [ctx.space], kind: 'action', name: 'sweep' })).toEqual({
      resumed: 2,
      functionJobs: []
    });
    expect(await queue.getJob([ctx.space], 'aside-1')).toMatchObject({ status: 'pending', attempts: 0 });
    expect(await statusOf('aside-2')).toBe('pending');
    expect(await statusOf('waiting')).toBe('pending');
    expect(await statusOf('digest-aside')).toBe('paused');
    expect(await statusOf('theirs', ctx.otherSpace)).toBe('paused');

    // Unnarrowed, every one set aside in the space: the functions' named, for whoever tells their watchers.
    expect(await queue.resumeWaiting({ spaceIds: [ctx.space] })).toEqual({
      resumed: 2,
      functionJobs: ['train-aside']
    });
    expect(await statusOf('digest-aside')).toBe('pending');
    expect(await queue.resumeWaiting({ spaceIds: [] })).toEqual({ resumed: 0, functionJobs: [] });
  });
};
