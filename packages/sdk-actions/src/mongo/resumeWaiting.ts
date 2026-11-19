import type { JobDocument } from './jobQueue';
import type { JobsResumed, JobsToResume } from '../types';
import type { Collection, Document } from 'mongodb';

/**
 * A job set aside, back in the queue at `at` (`resume`, `resumeWaiting`): one set aside after failing every attempt has
 * them all again.
 */
export const putBack = (at: number): Document[] => [
  {
    $set: {
      status: 'pending',
      runAt: at,
      updatedAt: at,
      attempts: { $cond: [{ $gte: ['$attempts', '$maxAttempts'] }, 0, '$attempts'] }
    }
  }
];

/** `JobQueue.resumeWaiting` over the jobs' collection: every job of these spaces set aside, back in one statement. */
export const resumeWaiting = async (
  jobs: Collection<JobDocument>,
  { spaceIds, kind, name }: JobsToResume,
  at: number
): Promise<JobsResumed> => {
  const filter = {
    spaceId: { $in: spaceIds },
    status: 'paused' as const,
    ...(name ? { 'target.name': name } : {}),
    ...(kind ? { 'target.kind': kind } : {})
  };
  // Read before they move: after, nothing tells them from the jobs that were waiting already.
  const watched =
    kind === 'action'
      ? []
      : await jobs.find({ ...filter, 'target.kind': 'function' }, { projection: { _id: 1 } }).toArray();
  const resumed = await jobs.updateMany(filter, putBack(at));

  return { resumed: resumed.modifiedCount, functionJobs: watched.map(job => job._id) };
};
