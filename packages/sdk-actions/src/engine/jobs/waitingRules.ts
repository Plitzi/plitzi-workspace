import type { JobsDropped, JobsResumed, JobsToDrop, JobsToResume } from '../../types';
import type { Job } from '@plitzi/sdk-shared';

/**
 * What an operator does to the jobs that have not started, at once — the in-process stores' half of `cancelWaiting` and
 * `resumeWaiting` (`queueRules`), over the jobs those keep and the instant their clock reads.
 */

/** A job set aside, back in the queue at `at`: one set aside after failing every attempt has them all again. */
export const putBack = (job: Job, at: number): void => {
  job.status = 'pending';
  job.runAt = at;
  job.updatedAt = at;
  if (job.attempts >= job.maxAttempts) {
    job.attempts = 0;
  }
};

const named = (job: Job, kind: JobsToDrop['kind'], name: string | undefined): boolean =>
  (kind === undefined || job.target.kind === kind) && (name === undefined || job.target.name === name);

export const cancelWaitingIn = (
  jobs: Iterable<Job>,
  { spaceIds, status, kind, name }: JobsToDrop,
  at: number
): JobsDropped => {
  const dropped: JobsDropped = { cancelled: 0, functionJobs: [] };
  for (const job of jobs) {
    if (
      spaceIds.includes(job.spaceId) &&
      (job.status === 'pending' || job.status === 'paused') &&
      (status === undefined || job.status === status) &&
      named(job, kind, name)
    ) {
      job.status = 'cancelled';
      job.workerId = undefined;
      job.pauseRequested = undefined;
      job.updatedAt = at;
      dropped.cancelled += 1;
      if (job.target.kind === 'function') {
        dropped.functionJobs.push(job.id);
      }
    }
  }

  return dropped;
};

export const resumeWaitingIn = (
  jobs: Iterable<Job>,
  { spaceIds, kind, name }: JobsToResume,
  at: number
): JobsResumed => {
  const put: JobsResumed = { resumed: 0, functionJobs: [] };
  for (const job of jobs) {
    if (spaceIds.includes(job.spaceId) && job.status === 'paused' && named(job, kind, name)) {
      putBack(job, at);
      put.resumed += 1;
      if (job.target.kind === 'function') {
        put.functionJobs.push(job.id);
      }
    }
  }

  return put;
};
