import { describe, expect, it } from 'vitest';

import { resumeAfterCodeChange, setAsideByItsCode } from './codeChanged';

import type { JobQueue } from '../../types';
import type { Job, JobAttempt } from '@plitzi/sdk-shared';

const attempt = (over: Partial<JobAttempt>): JobAttempt => ({
  attempt: 1,
  status: 'failed',
  startedAt: 0,
  endedAt: 0,
  workerId: 'pod-a',
  ...over
});

const job = (id: string, over: Partial<Job> = {}): Job => ({
  id,
  spaceId: 7,
  environment: 'main',
  target: { kind: 'action', name: 'sweep', trigger: 'schedule' },
  input: {},
  status: 'paused',
  attempts: 1,
  maxAttempts: 3,
  dueAt: 0,
  runAt: 0,
  createdAt: 0,
  updatedAt: 0,
  history: [],
  ...over
});

const SET_ASIDE = [
  job('at-cpu', { history: [attempt({ limit: 'cpu' })] }),
  job('at-memory', { history: [attempt({ limit: 'memory' })] }),
  job('failed-out', { attempts: 3, history: [attempt({ attempt: 3 })] }),
  job('at-quota', { history: [attempt({ limit: 'quota' })] }),
  job('by-hand', { history: [attempt({ status: 'paused' })] }),
  job('by-hand-waiting'),
  job('for-a-worker', { attempts: 1, history: [attempt({ status: 'lost' })] })
];

/** A queue holding `held` set aside, read a page at a time, which records what it was asked to resume. */
const queueOf = (held: Job[], page = 3) => {
  const resumed: string[] = [];
  const queue = {
    listJobs: ({ offset }: { offset: number }) =>
      Promise.resolve({ jobs: held.slice(offset, offset + page), total: held.length }),
    resume: (_spaceIds: number[], id: string) => {
      resumed.push(id);

      return Promise.resolve(true);
    }
  };

  // Only what resuming after a change of code asks of a queue: its jobs set aside, and to put one back.
  return { queue: queue as unknown as JobQueue, resumed };
};

describe('a space’s code changed', () => {
  // Meridian's sweep was fixed and seeded, and its schedule went on waiting on the run set aside at the old code's CPU
  // limit — a day, or somebody to resume it by hand.
  it('puts back what its code set aside, at a limit or failing every attempt, and nothing set aside for anything else', async () => {
    const { queue, resumed } = queueOf(SET_ASIDE);

    expect(await resumeAfterCodeChange(queue, 7)).toEqual(['at-cpu', 'at-memory', 'failed-out']);
    expect(resumed).toEqual(['at-cpu', 'at-memory', 'failed-out']);
  });

  it('reads every page of what is set aside, and answers only what went back', async () => {
    const { queue } = queueOf([...SET_ASIDE, job('late', { history: [attempt({ limit: 'calls' })] })], 2);

    expect(await resumeAfterCodeChange(queue, 7)).toEqual(['at-cpu', 'at-memory', 'failed-out', 'late']);
  });

  it('says a job not set aside was not one', () => {
    expect(setAsideByItsCode(job('running', { status: 'running', history: [attempt({ limit: 'cpu' })] }))).toBe(false);
  });
});
