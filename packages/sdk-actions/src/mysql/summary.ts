import { selectRows } from '@plitzi/sdk-kernel/mysql';

import { noJobsByStatus, waitingKindOf } from '../engine/jobs/queueRules';

import type { JobQueueSummary, WaitingJobs } from '../types';
import type { JobStatus } from '@plitzi/sdk-shared';
import type { Pool } from 'mysql2/promise';

/** A count or an instant as the driver hands it back: a number, or a string for a BIGINT or a SUM. */
type Numeric = number | string;

const TRIGGER = "JSON_UNQUOTE(JSON_EXTRACT(target, '$.trigger'))";
const WAITING = "status IN ('pending', 'paused')";

/**
 * The jobs table at a glance (`JobQueue.summarize`), counted by MySQL: every status, what waits by what it is, and the
 * spaces with the most waiting — with what the job of each touched last said.
 */
export const summarizeJobsTable = async (conn: Pool, table: string, spaces: number): Promise<JobQueueSummary> => {
  const [statuses, kinds, bySpace] = await Promise.all([
    selectRows<{ status: JobStatus; n: Numeric }>(
      conn,
      `SELECT status, COUNT(*) AS n FROM ${table} GROUP BY status`,
      []
    ),
    selectRows<{ kind: string; trig: string | null; n: Numeric; oldest: Numeric }>(
      conn,
      `SELECT target_kind AS kind, ${TRIGGER} AS trig, COUNT(*) AS n, MIN(due_at) AS oldest
         FROM ${table} WHERE ${WAITING} GROUP BY target_kind, trig`,
      []
    ),
    selectRows<{
      space_id: Numeric;
      waiting: Numeric;
      calls: Numeric | null;
      oldest: Numeric;
      last_error: string | null;
    }>(
      conn,
      `SELECT j.space_id, COUNT(*) AS waiting, SUM(JSON_UNQUOTE(JSON_EXTRACT(j.target, '$.trigger')) = 'call') AS calls,
              MIN(j.due_at) AS oldest,
              (SELECT l.error FROM ${table} l WHERE l.space_id = j.space_id AND l.${WAITING}
                ORDER BY l.updated_at DESC LIMIT 1) AS last_error
         FROM ${table} j WHERE j.${WAITING}
         GROUP BY j.space_id ORDER BY waiting DESC, oldest ASC LIMIT ?`,
      [spaces]
    )
  ]);
  const byStatus = noJobsByStatus();
  statuses.forEach(row => {
    byStatus[row.status] = Number(row.n);
  });
  const waiting: WaitingJobs = { calls: 0, schedules: 0, later: 0, functionJobs: 0, other: 0 };
  let oldestDueAt: number | undefined;
  kinds.forEach(row => {
    waiting[waitingKindOf(row.kind, row.trig)] += Number(row.n);
    oldestDueAt = oldestDueAt === undefined ? Number(row.oldest) : Math.min(oldestDueAt, Number(row.oldest));
  });

  return {
    byStatus,
    waiting,
    ...(oldestDueAt === undefined ? {} : { oldestDueAt }),
    spaces: bySpace.map(row => ({
      spaceId: Number(row.space_id),
      waiting: Number(row.waiting),
      calls: Number(row.calls ?? 0),
      oldestDueAt: Number(row.oldest),
      ...(row.last_error ? { lastError: row.last_error } : {})
    }))
  };
};
