import { isRecord } from '@plitzi/sdk-shared/helpers';

import { scheduleKey } from './queueRules';

import type { QueueState } from './queueRules';
import type { ActionSchedule, Job } from '@plitzi/sdk-shared';

/**
 * A queue's state as one document — what `createFileJobQueue` writes to its file and `createSqliteJobQueue` to its row —
 * versioned so a later layout can tell an old one from a broken one.
 */
export type QueueDocument = { format: 1; jobs: Job[]; schedules: ActionSchedule[] };

export const documentOf = ({ jobs, schedules }: QueueState): QueueDocument => ({
  format: 1,
  jobs: [...jobs.values()],
  schedules: [...schedules.values()]
});

// What a job and a schedule are known by: a document that lacks it is no queue's, and is refused rather than half read.
const isJob = (value: unknown): value is Job =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.spaceId === 'number' &&
  typeof value.status === 'string' &&
  typeof value.runAt === 'number' &&
  isRecord(value.target) &&
  Array.isArray(value.history);

const isSchedule = (value: unknown): value is ActionSchedule =>
  isRecord(value) &&
  typeof value.spaceId === 'number' &&
  typeof value.actionId === 'string' &&
  typeof value.nextRunAt === 'number';

/** The state a document holds — or why it is no queue's, for the store to say with its fix. */
export const stateOf = (parsed: unknown): QueueState | string => {
  if (!isRecord(parsed) || parsed.format !== 1) {
    return 'no `format: 1`';
  }

  if (!Array.isArray(parsed.jobs) || !parsed.jobs.every(isJob)) {
    return 'its `jobs` are not jobs';
  }

  if (!Array.isArray(parsed.schedules) || !parsed.schedules.every(isSchedule)) {
    return 'its `schedules` are not schedules';
  }

  return {
    jobs: new Map(parsed.jobs.map(job => [job.id, job])),
    schedules: new Map(parsed.schedules.map(schedule => [scheduleKey(schedule.spaceId, schedule.actionId), schedule]))
  };
};
