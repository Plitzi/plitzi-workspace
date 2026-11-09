import { expect, it } from 'vitest';

import type { JobQueue, JobTake } from '../../../types';
import type { JobInput } from '@plitzi/sdk-shared';

/** What the space-code half of the job queue contract reads of the contract around it. */
export type CodeClaimsSubject = {
  queue: () => JobQueue;
  job: (over?: Partial<JobInput>) => Promise<JobInput>;
};

/**
 * A worker shares its room between kinds of work (`takes`), run inside `describeJobQueue` against each store: actions
 * that run no space code (`light`), actions that do (`codeActions`, marked `code`), and the functions' jobs.
 */
export const describeCodeClaims = (ctx: CodeClaimsSubject): void => {
  it('takes only the kind of work it is asked for, and every job otherwise', async () => {
    const code = { kind: 'action', name: 'digest', trigger: 'schedule', code: true } as const;
    await ctx.queue().enqueue(await ctx.job({ id: 'runs-code', target: code }));
    await ctx.queue().enqueue(await ctx.job({ id: 'a-function', target: { kind: 'function', name: 'train' } }));
    await ctx.queue().enqueue(await ctx.job({ id: 'runs-none' }));

    const ids = async (takes?: JobTake) =>
      (await ctx.queue().claim({ workerId: 'pod-a', leaseMs: 60_000, limit: 5, ...(takes ? { takes } : {}) })).map(
        each => each.id
      );

    expect(await ids('functionJobs')).toEqual(['a-function']);
    expect(await ids('light')).toEqual(['runs-none']);
    expect(await ids('codeActions')).toEqual(['runs-code']);
    expect(await ids()).toEqual([]);
  });
};
