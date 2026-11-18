import { selectOne, selectRows } from '@plitzi/sdk-kernel/mysql';

import { LISTED_JOB_COLUMNS, toJob } from './rows';

import type { JobRow, Numeric } from './rows';
import type { JobGroup, JobQuery } from '../types';
import type { Pool } from 'mysql2/promise';

/** Digits an epoch-ms `updated_at` is padded to, so its text sorts as the number does. */
const LATEST_PAD = 20;

/** The jobs a list names (`listJobs`, `listJobGroups`): the clause and its parameters. */
export const listWhere = ({ spaceIds, name, status, kind }: JobQuery): { sql: string; params: unknown[] } => ({
  sql: [
    'space_id IN (?)',
    ...(name ? ['target_name = ?'] : []),
    ...(status ? ['status = ?'] : []),
    ...(kind ? ['target_kind = ?'] : [])
  ].join(' AND '),
  params: [spaceIds, ...(name ? [name] : []), ...(status ? [status] : []), ...(kind ? [kind] : [])]
});

/**
 * `JobQueue.listJobGroups` over the jobs table: a group per space, work and status, the one of the most recently
 * touched job first. Each group's latest job — by `updated_at`, then `id`, as `listJobs` orders them — is read off one
 * MAX of the two written as one string: MySQL 5.7 has no window functions. A query naming no space is answered empty
 * by the caller (`IN ()` is not SQL).
 */
export const listJobGroupsOf = async (
  conn: Pool,
  table: string,
  query: JobQuery
): Promise<{ groups: JobGroup[]; total: number; jobs: number }> => {
  const where = listWhere(query);
  const grouped = `FROM ${table} WHERE ${where.sql} GROUP BY space_id, target_kind, target_name, status`;

  const [found, count] = await Promise.all([
    selectRows<{ latest: string; n: Numeric; first_due: Numeric; last_due: Numeric }>(
      conn,
      `SELECT MAX(CONCAT(LPAD(updated_at, ${String(LATEST_PAD)}, '0'), id)) AS latest, COUNT(*) AS n,
         MIN(due_at) AS first_due, MAX(due_at) AS last_due
       ${grouped} ORDER BY latest DESC LIMIT ? OFFSET ?`,
      [...where.params, query.limit, query.offset]
    ),
    selectOne<{ total: Numeric; jobs: Numeric | null }>(
      conn,
      `SELECT COUNT(*) AS total, SUM(n) AS jobs FROM (SELECT COUNT(*) AS n ${grouped}) AS g`,
      where.params
    )
  ]);
  const ids = found.map(group => group.latest.slice(LATEST_PAD));
  const rows =
    ids.length > 0
      ? await selectRows<JobRow>(conn, `SELECT ${LISTED_JOB_COLUMNS} FROM ${table} WHERE id IN (?)`, [ids])
      : [];
  const latest = new Map(rows.map(row => [row.id, toJob(row)]));

  return {
    // A latest job removed between the two reads leaves its group out of this page, never a row with no job.
    groups: found.flatMap((group, at) => {
      const job = latest.get(ids[at] ?? '');

      return job
        ? [
            {
              latest: job,
              count: Number(group.n),
              firstDueAt: Number(group.first_due),
              lastDueAt: Number(group.last_due)
            }
          ]
        : [];
    }),
    total: Number(count?.total ?? 0),
    jobs: Number(count?.jobs ?? 0)
  };
};
