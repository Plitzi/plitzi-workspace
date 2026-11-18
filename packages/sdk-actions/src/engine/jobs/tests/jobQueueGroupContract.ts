import { expect, it } from 'vitest';

import type { JobQueue } from '../../../types';
import type { JobInput } from '@plitzi/sdk-shared';

/** What this half of the job queue contract reads of the contract around it. */
export type JobGroupsSubject = {
  queue: () => JobQueue;
  job: (over?: Partial<JobInput>) => Promise<JobInput>;
  wait: (ms: number) => Promise<unknown>;
  space: number;
  otherSpace: number;
};

/**
 * The queue read as a person scans it (`listJobGroups`), run inside `describeJobQueue` against each store: a schedule
 * whose every fire was set aside is one row that says how many — paged and counted by rows, never folded within a page.
 */
export const describeJobGroups = (ctx: JobGroupsSubject): void => {
  it('groups jobs by space, work and status, pages and counts the groups, and says how many each holds', async () => {
    const queue = ctx.queue();
    const later = (await queue.now()).getTime() + 60_000;
    const sweep = (id: string, over: Partial<JobInput> = {}) =>
      ctx.job({ id, dueAt: later, target: { kind: 'action', name: 'sweep', trigger: 'schedule' }, ...over });

    await queue.enqueue(await sweep('sweep-1', { dueAt: later + 1_000 }));
    await ctx.wait(5);
    await queue.enqueue(await ctx.job({ id: 'digest-1', dueAt: later }));
    await ctx.wait(5);
    await queue.enqueue(await sweep('sweep-2', { dueAt: later + 3_000 }));
    await ctx.wait(5);
    await queue.enqueue(await sweep('sweep-3', { dueAt: later + 2_000 }));
    await ctx.wait(5);
    await queue.enqueue(
      await ctx.job({ id: 'train-1', dueAt: later - 120_000, target: { kind: 'function', name: 'train' } })
    );
    await queue.claim({ workerId: 'pod-a', leaseMs: 60_000, limit: 1 });
    await queue.write({ jobId: 'train-1', workerId: 'pod-a', state: { epoch: 2 } });
    await queue.enqueue(await sweep('theirs', { spaceId: ctx.otherSpace }));

    const all = await queue.listJobGroups({ spaceIds: [ctx.space], limit: 10, offset: 0 });
    expect(all.total).toBe(3);
    expect(all.jobs).toBe(5);
    expect(all.groups.map(group => [group.latest.id, group.latest.status, group.count])).toEqual([
      ['train-1', 'running', 1],
      ['sweep-3', 'pending', 3],
      ['digest-1', 'pending', 1]
    ]);
    expect(all.groups[1]).toMatchObject({ firstDueAt: later + 1_000, lastDueAt: later + 3_000 });
    // What a job of the functions saved is no row's: it stays out of the list.
    expect(all.groups[0]?.latest).not.toHaveProperty('state');

    // Paged by groups: the second page of one is the second group, whole, and the total is still the groups'.
    const second = await queue.listJobGroups({ spaceIds: [ctx.space], limit: 1, offset: 1 });
    expect(second).toMatchObject({ total: 3, jobs: 5 });
    expect(second.groups.map(group => [group.latest.id, group.count])).toEqual([['sweep-3', 3]]);

    // Narrowed as `listJobs` is: the group then holds what `cancelWaiting` would drop with the same narrowing.
    const sweeps = await queue.listJobGroups({
      spaceIds: [ctx.space],
      status: 'pending',
      name: 'sweep',
      limit: 10,
      offset: 0
    });
    expect(sweeps.groups.map(group => [group.latest.id, group.count])).toEqual([['sweep-3', 3]]);
    expect(await queue.listJobGroups({ spaceIds: [ctx.space], kind: 'function', limit: 10, offset: 0 })).toMatchObject({
      total: 1,
      groups: [{ latest: { id: 'train-1' }, count: 1 }]
    });

    expect(await queue.listJobGroups({ spaceIds: [], limit: 10, offset: 0 })).toEqual({
      groups: [],
      total: 0,
      jobs: 0
    });
  });
};
