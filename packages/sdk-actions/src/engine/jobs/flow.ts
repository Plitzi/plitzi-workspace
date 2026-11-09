import type { JobFlowMinute } from '../../types';
import type { Job } from '@plitzi/sdk-shared';

const MINUTE = 60_000;

/** What `flowOf` reads of a job: when it was due, its attempts, and the one it is running, if any. */
export type FlowJob = Pick<Job, 'dueAt' | 'history' | 'status' | 'updatedAt' | 'attempts'>;

const p95 = (values: number[]): number | undefined => {
  if (values.length === 0) {
    return undefined;
  }

  const sorted = [...values].sort((a, b) => a - b);

  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)];
};

/**
 * The queue's flow minute by minute over `[from, to)`, from the jobs that touch it: what fell due in each, what was
 * started and ended, and how long a job waited from due to its first attempt — what tells a queue that keeps up from
 * one that falls behind. A job running now started its attempt when it was claimed (`updatedAt`). Every store reads
 * the jobs it may have to count — due in the span, or written since it began — and hands them here.
 */
export const flowOf = (jobs: Iterable<FlowJob>, from: number, to: number): JobFlowMinute[] => {
  const first = Math.floor(from / MINUTE);
  const last = Math.ceil(to / MINUTE);
  const minutes = Array.from({ length: Math.max(0, last - first) }, (_item, index) => ({
    minute: first + index,
    due: 0,
    started: 0,
    ended: 0,
    waits: [] as number[]
  }));
  const at = (instant: number) =>
    instant >= from && instant < to ? minutes[Math.floor(instant / MINUTE) - first] : undefined;

  for (const job of jobs) {
    const dueIn = at(job.dueAt);
    if (dueIn) {
      dueIn.due += 1;
    }

    const starts = [
      ...job.history.map(attempt => ({ attempt: attempt.attempt, startedAt: attempt.startedAt })),
      ...(job.status === 'running' ? [{ attempt: job.attempts, startedAt: job.updatedAt }] : [])
    ];
    for (const { attempt, startedAt } of starts) {
      const startedIn = at(startedAt);
      if (startedIn) {
        startedIn.started += 1;
        if (attempt === 1) {
          startedIn.waits.push(Math.max(0, startedAt - job.dueAt));
        }
      }
    }

    for (const attempt of job.history) {
      const endedIn = at(attempt.endedAt);
      if (endedIn) {
        endedIn.ended += 1;
      }
    }
  }

  return minutes.map(({ waits, ...counts }) => {
    const waitP95Ms = p95(waits);

    return waitP95Ms === undefined ? counts : { ...counts, waitP95Ms };
  });
};
