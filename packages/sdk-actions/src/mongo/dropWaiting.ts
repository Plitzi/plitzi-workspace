import type { JobDocument } from './jobQueue';
import type { JobsDropped, JobsToDrop } from '../types';
import type { JobStatus } from '@plitzi/sdk-shared';
import type { Collection } from 'mongodb';

/**
 * `JobQueue.cancelWaiting` over the jobs' collection: everything of these spaces that has not started is `cancelled` at
 * `at`, in one statement, and kept until `expiresAt` like any finished job.
 */
export const dropWaiting = async (
  jobs: Collection<JobDocument>,
  { spaceIds, status, kind, name }: JobsToDrop,
  at: number,
  expiresAt: Date
): Promise<JobsDropped> => {
  const statuses: JobStatus[] = status ? [status] : ['pending', 'paused'];
  const filter = {
    spaceId: { $in: spaceIds },
    status: { $in: statuses },
    ...(name ? { 'target.name': name } : {}),
    ...(kind ? { 'target.kind': kind } : {})
  };
  // Read before they are dropped: after, nothing tells them from the ones cancelled before. One that moved between the
  // two statements is told as it then is — whoever tells its watchers reads the job, not this list.
  const watched =
    kind === 'action'
      ? []
      : await jobs.find({ ...filter, 'target.kind': 'function' }, { projection: { _id: 1 } }).toArray();
  const dropped = await jobs.updateMany(filter, {
    $set: { status: 'cancelled', updatedAt: at, expiresAt },
    $unset: { workerId: '', pauseRequested: '' }
  });

  return { cancelled: dropped.modifiedCount, functionJobs: watched.map(job => job._id) };
};
