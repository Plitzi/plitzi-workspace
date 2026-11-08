import { expect, it } from 'vitest';

import type { JobQueue } from '../../../types';
import type { JobInput } from '@plitzi/sdk-shared';

/** What the space-code half of the job queue contract reads of the contract around it. */
export type CodeClaimsSubject = {
  queue: () => JobQueue;
  job: (over?: Partial<JobInput>) => Promise<JobInput>;
};

/**
 * A worker whose runs wait for a functions runner with room takes only the jobs that need none (`withoutCode`), run
 * inside `describeJobQueue` against each store: an action's that runs no space code — never one marked `code`, never a
 * function's job.
 */
export const describeCodeClaims = (ctx: CodeClaimsSubject): void => {
  it('takes only jobs that run no space code when asked, and every job otherwise', async () => {
    const code = { kind: 'action', name: 'digest', trigger: 'schedule', code: true } as const;
    await ctx.queue().enqueue(await ctx.job({ id: 'runs-code', target: code }));
    await ctx.queue().enqueue(await ctx.job({ id: 'a-function', target: { kind: 'function', name: 'train' } }));
    await ctx.queue().enqueue(await ctx.job({ id: 'runs-none' }));

    const light = await ctx.queue().claim({ workerId: 'pod-a', leaseMs: 60_000, limit: 5, withoutCode: true });
    const rest = await ctx.queue().claim({ workerId: 'pod-b', leaseMs: 60_000, limit: 5 });

    expect(light.map(each => each.id)).toEqual(['runs-none']);
    expect(rest.map(each => each.id).sort()).toEqual(['a-function', 'runs-code']);
  });
};
