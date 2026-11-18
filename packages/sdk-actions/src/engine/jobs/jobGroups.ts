import type { JobGroup } from '../../types';
import type { Job } from '@plitzi/sdk-shared';

/**
 * Jobs, the most recently touched first, as `JobQueue.listJobGroups` answers them: a group per space, work and status,
 * in the order their latest jobs come — what the in-process stores' rules (`queueRules`) page.
 */
export const groupJobs = (newestFirst: readonly Job[]): JobGroup[] => {
  const groups = new Map<string, JobGroup>();
  for (const job of newestFirst) {
    const key = [job.spaceId, job.target.kind, job.target.name, job.status].join('\u0000');
    const group = groups.get(key);
    if (group) {
      group.count += 1;
      group.firstDueAt = Math.min(group.firstDueAt, job.dueAt);
      group.lastDueAt = Math.max(group.lastDueAt, job.dueAt);
      continue;
    }

    const { state: _state, ...latest } = job;
    groups.set(key, { latest, count: 1, firstDueAt: job.dueAt, lastDueAt: job.dueAt });
  }

  return [...groups.values()];
};
