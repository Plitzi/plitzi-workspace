import { describe, expect, it } from 'vitest';

import { claimsWithin } from './notNow';
import { takeOf } from './queueRules';
import { jobInput } from './tests/jobWorld';

import type { JobQueue, JobTake } from '../../types';
import type { Job } from '@plitzi/sdk-shared';

/** A queue holding so many jobs of each kind of work, taking them as a claim's `takes` asks. */
const queueOf = (counts: Record<JobTake, number>): JobQueue => {
  const targets: Record<JobTake, Job['target']> = {
    light: { kind: 'action', name: 'beat', trigger: 'schedule' },
    codeActions: { kind: 'action', name: 'sync', trigger: 'schedule', code: true },
    functionJobs: { kind: 'function', name: 'train' }
  };
  const left = { ...counts };
  const claim: JobQueue['claim'] = ({ limit, takes }) => {
    const kinds = takes ? [takes] : (['light', 'codeActions', 'functionJobs'] as const);
    const jobs: Job[] = [];
    for (const kind of kinds) {
      while (left[kind] > 0 && jobs.length < limit) {
        left[kind] -= 1;
        // The claims read a job's target alone: an input stands for the job the queue would answer.
        jobs.push(jobInput({ id: `${kind}-${String(left[kind])}`, target: targets[kind] }) as unknown as Job);
      }
    }

    return Promise.resolve(jobs);
  };

  // A test's queue: only `claim` is asked of it here.
  return { claim } as unknown as JobQueue;
};

const kindsOf = (jobs: Job[]): Record<string, number> =>
  jobs.reduce<Record<string, number>>(
    (all, job) => ({ ...all, [takeOf(job.target)]: (all[takeOf(job.target)] ?? 0) + 1 }),
    {}
  );

const claim = { workerId: 'pod-a', leaseMs: 60_000, limit: 50 };

/**
 * Taken in the queue's order, a burst's actions held 100 minute-long jobs back for two and a half minutes — sustained, for
 * ever. The room for work that needs a runner is shared by turns: half each, what one leaves the other takes.
 */
describe('a look’s claims', () => {
  it('takes every job that needs no runner, and shares the runner room half and half', async () => {
    const take = claimsWithin(queueOf({ light: 3, codeActions: 10, functionJobs: 10 }), 2, 'functionJobs');

    expect(kindsOf(await take(claim))).toEqual({ light: 3, functionJobs: 4, codeActions: 4 });
  });

  it('gives the other kind what one leaves', async () => {
    const take = claimsWithin(queueOf({ light: 0, codeActions: 10, functionJobs: 1 }), 2, 'functionJobs');

    expect(kindsOf(await take(claim))).toEqual({ functionJobs: 1, codeActions: 7 });
  });

  it('offers an odd room’s extra place to the kind whose turn it is', async () => {
    const counts = { light: 0, codeActions: 10, functionJobs: 10 };

    expect(kindsOf(await claimsWithin(queueOf(counts), 7, 'codeActions')(claim))).toEqual({
      codeActions: 2,
      functionJobs: 1
    });
    expect(kindsOf(await claimsWithin(queueOf(counts), 7, 'functionJobs')(claim))).toEqual({
      functionJobs: 2,
      codeActions: 1
    });
  });

  // Light jobs first, a steady flow of them took every slot and held both kinds that need a runner back for ever.
  it('offers the work that needs a runner its room before a flood of light jobs takes the slots', async () => {
    const take = claimsWithin(queueOf({ light: 100, codeActions: 5, functionJobs: 5 }), 6, 'codeActions');

    expect(kindsOf(await take({ ...claim, limit: 10 }))).toEqual({ codeActions: 2, functionJobs: 2, light: 6 });
  });
});
