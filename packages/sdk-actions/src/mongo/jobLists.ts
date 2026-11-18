import type { JobDocument } from './jobQueue';
import type { JobGroup, JobQuery } from '../types';
import type { Collection, Filter } from 'mongodb';

/** The jobs a list names (`listJobs`, `listJobGroups`). */
export const listFilter = ({ spaceIds, name, status, kind }: JobQuery): Filter<JobDocument> => ({
  spaceId: { $in: spaceIds },
  ...(name ? { 'target.name': name } : {}),
  ...(status ? { status } : {}),
  ...(kind ? { 'target.kind': kind } : {})
});

/** A group as the collection answers it: its latest job still a document. */
export type JobGroupDocument = Omit<JobGroup, 'latest'> & { latest: JobDocument };

/**
 * `JobQueue.listJobGroups` over the jobs' collection, in one pass — the page and the count alike: a group per space,
 * work and status, the one of the most recently touched job first. What a job of the functions saved is left out before
 * the grouping: up to megabytes per job, and no row shows it.
 */
export const listJobGroupsOf = async (
  jobs: Collection<JobDocument>,
  query: JobQuery
): Promise<{ groups: JobGroupDocument[]; total: number; jobs: number }> => {
  const [found] = await jobs
    .aggregate<{ page: JobGroupDocument[]; total: { groups: number; jobs: number }[] }>([
      { $match: listFilter(query) },
      { $project: { state: 0 } },
      { $sort: { updatedAt: -1, _id: -1 } },
      {
        $group: {
          _id: { spaceId: '$spaceId', kind: '$target.kind', name: '$target.name', status: '$status' },
          latest: { $first: '$$ROOT' },
          count: { $sum: 1 },
          firstDueAt: { $min: '$dueAt' },
          lastDueAt: { $max: '$dueAt' }
        }
      },
      { $sort: { 'latest.updatedAt': -1, 'latest._id': -1 } },
      {
        $facet: {
          // Mongo refuses a `$limit` of 0: one is read, and none of it kept, when a page of none is asked for.
          page: [{ $skip: query.offset }, { $limit: Math.max(1, query.limit) }, { $project: { _id: 0 } }],
          total: [{ $group: { _id: null, groups: { $sum: 1 }, jobs: { $sum: '$count' } } }]
        }
      }
    ])
    .toArray();

  const total = found.total.at(0);

  return { groups: found.page.slice(0, query.limit), total: total?.groups ?? 0, jobs: total?.jobs ?? 0 };
};
