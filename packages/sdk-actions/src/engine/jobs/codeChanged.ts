import { SET_ASIDE_LIMITS } from './endings';

import type { JobQueue } from '../../types';
import type { Job } from '@plitzi/sdk-shared';

/** How many of a space's jobs set aside are read at a time. */
const PAGE = 200;

/**
 * Whether a job was set aside for what its own code did — stopped at a limit its run reached (its CPU, its memory, its
 * calls…), or failing every attempt — rather than by hand, at its plan's allowance (`quota`), or because a worker died
 * running it (that one waits for a worker large enough, not for new code).
 */
export const setAsideByItsCode = (job: Pick<Job, 'status' | 'history' | 'attempts' | 'maxAttempts'>): boolean => {
  if (job.status !== 'paused') {
    return false;
  }

  const last = job.history.at(-1);
  if (last?.limit !== undefined) {
    return last.limit !== 'quota' && SET_ASIDE_LIMITS.has(last.limit);
  }

  return last?.status === 'failed' && job.attempts >= job.maxAttempts;
};

/**
 * A space's code changed — its functions or its actions saved: every job of it set aside for what its code did goes back
 * in the queue, to run as the code now is. A schedule waiting on one fires again with it (`scheduleHold`); one that
 * meets the same limit is set aside again, and its schedule waits again — one run, not a fire a minute. What was set
 * aside by hand, at the plan's allowance or for a larger worker stays where it is. Answers the jobs it put back.
 */
export const resumeAfterCodeChange = async (queue: JobQueue, spaceId: number): Promise<string[]> => {
  // Every page read before any goes back: a job resumed leaves `paused`, and the pages after it would shift under it.
  const setAside: Job[] = [];
  for (;;) {
    const { jobs, total } = await queue.listJobs({
      spaceIds: [spaceId],
      status: 'paused',
      limit: PAGE,
      offset: setAside.length
    });
    setAside.push(...jobs);
    if (jobs.length === 0 || setAside.length >= total) {
      break;
    }
  }

  const again = setAside.filter(setAsideByItsCode);
  const resumed = await Promise.all(again.map(job => queue.resume([spaceId], job.id)));

  return again.filter((_, index) => resumed[index]).map(job => job.id);
};
