import { execute, selectRows } from '@plitzi/sdk-kernel/mysql';

import type { JobRow } from './rows';
import type { JobsResumed, JobsToResume } from '../types';
import type { Pool } from 'mysql2/promise';

/**
 * A job set aside, back in the queue at the instant of the statement's first two parameters (`resume`,
 * `resumeWaiting`): one set aside after failing every attempt has them all again.
 */
export const PUT_BACK =
  "status = 'pending', run_at = ?, updated_at = ?, attempts = IF(attempts >= max_attempts, 0, attempts)";

/**
 * `JobQueue.resumeWaiting` over the jobs table: every job of these spaces set aside, back in one statement. A query
 * naming no space is answered empty by the caller (`IN ()` is not SQL).
 */
export const resumeWaitingOf = async (
  conn: Pool,
  table: string,
  { spaceIds, kind, name }: JobsToResume,
  at: number
): Promise<JobsResumed> => {
  const where = [
    'space_id IN (?)',
    "status = 'paused'",
    ...(name ? ['target_name = ?'] : []),
    ...(kind ? ['target_kind = ?'] : [])
  ].join(' AND ');
  const params: unknown[] = [spaceIds, ...(name ? [name] : []), ...(kind ? [kind] : [])];
  // Read before they move: after, nothing tells them from the jobs that were waiting already.
  const watched =
    kind === 'action'
      ? []
      : await selectRows<Pick<JobRow, 'id'>>(
          conn,
          `SELECT id FROM ${table} WHERE ${where} AND target_kind = 'function'`,
          params
        );
  const resumed = await execute(conn, `UPDATE ${table} SET ${PUT_BACK} WHERE ${where}`, [at, at, ...params]);

  return { resumed: resumed.affectedRows, functionJobs: watched.map(row => row.id) };
};
