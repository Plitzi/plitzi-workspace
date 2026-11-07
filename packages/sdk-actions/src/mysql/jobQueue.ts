import { execute, selectOne, selectRows } from '@plitzi/sdk-kernel/mysql';
import { TERMINAL_JOB_STATUSES } from '@plitzi/sdk-shared/actions';

import { claimable, jsonOrNull, toJob, toSchedule } from './rows';
import { ensureJobTables, jobTables, NOW_MS } from './schema';
import { summarizeJobsTable } from './summary';
import { flowOf } from '../engine/jobs/flow';
import { lostError, LOST_ERROR, needsAfterLoss, outgrewWorker, SET_ASIDE_WORDS } from '../engine/jobs/memoryNeeds';
import { createStoreClock } from '../engine/jobs/storeClock';

import type { JobQuery, JobQueue, JobSettlement, JobStop, JobWrite } from '../types';
import type { JobRow, Numeric, ScheduleRow } from './rows';
import type { Job, JobAttempt, JobInput, JobStatus } from '@plitzi/sdk-shared';
import type { Pool, PoolConnection } from 'mysql2/promise';

/** Spread into a plain array: the queries take a mutable list. */
const TERMINAL: JobStatus[] = [...TERMINAL_JOB_STATUSES];

const DAY_MS = 24 * 60 * 60 * 1000;

/** How often finished jobs past their retention are removed — at most once a minute per process, on a write. */
const PURGE_EVERY_MS = 60_000;

export type MysqlJobQueueOptions = {
  /** A pool the deployment opened. The helper borrows connections from it and never ends it. */
  pool: Pool;
  /** Prefix for the three tables — `action_jobs`, `action_schedules`, `action_kv`. Default none. */
  tablePrefix?: string;
  /**
   * Create the tables on first use (`CREATE TABLE IF NOT EXISTS`). Default true; false for a deployment that runs
   * {@link mysqlJobSchemaStatements} through its own migrations.
   */
  createTables?: boolean;
  /** How long a finished job stays readable. A waiting or running one never expires. Default 90 days. */
  retentionDays?: number;
};

export type MysqlJobQueue = JobQueue & {
  /** Takes the store's clock again on the next call — after a failover to another primary. */
  resyncClock: () => void;
};

/** MySQL's answer when two transactions wait on each other: one is rolled back, and is meant to be run again. */
const DEADLOCK = 'ER_LOCK_DEADLOCK';
const TRANSACTION_ATTEMPTS = 3;

/** Claim rounds per call: a worker that lost every row it read to other workers looks once more, then waits a poll. */
const CLAIM_ROUNDS = 3;

/** Lapsed jobs reaped per claim: the rest are reaped by the next one, a poll later. */
const REAP_ROWS = 50;

/**
 * One connection, one transaction: what a settlement or a schedule write needs so the rows it read stay locked until
 * it writes. A deadlock is retried — MySQL picks a victim and expects it to try again, which is what two replicas
 * reconciling the same space at boot will occasionally make it do.
 */
const transaction = async <T>(pool: Pool, work: (connection: PoolConnection) => Promise<T>): Promise<T> => {
  for (let attempt = 1; ; attempt += 1) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await work(connection);
      await connection.commit();

      return result;
    } catch (error) {
      await connection.rollback();
      if ((error as { code?: string }).code !== DEADLOCK || attempt >= TRANSACTION_ATTEMPTS) {
        throw error;
      }
    } finally {
      connection.release();
    }
  }
};

/** MySQL's code for a primary key that refused a second row with the same value. */
const DUPLICATE_ENTRY = 'ER_DUP_ENTRY';

/**
 * An {@link JobQueue} over tables in a MySQL database the deployment owns. Tested on MySQL 8; nothing in it
 * needs more than 5.7.
 *
 * The helper for a deployment that already runs MySQL: it borrows connections from the pool it is handed, and creates
 * its three tables on first use unless told not to. Every replica pointed at the same database shares the jobs and the
 * schedules.
 *
 * ```ts
 * import mysql from 'mysql2/promise';
 * import { createMysqlJobQueue, createMysqlKv } from '@plitzi/sdk-actions/mysql';
 *
 * const pool = mysql.createPool(process.env.DATABASE_URL);
 * createServer({ action: { lookups, kv: createMysqlKv({ pool }), jobs: { queue: createMysqlJobQueue({ pool }) } } });
 * ```
 *
 * The contract's rules, as MySQL keeps them: every instant is the SERVER's (`NOW(3)`), `enqueue` is idempotent by the
 * primary key, `claim` takes each job with a single-row compare-and-set — so two workers never take the same one —
 * and reaps a lapsed lease in the same write, and a schedule advances by compare-and-set too.
 */
export const createMysqlJobQueue = ({
  pool,
  tablePrefix = '',
  createTables = true,
  retentionDays = 90
}: MysqlJobQueueOptions): MysqlJobQueue => {
  const t = jobTables(tablePrefix);
  const ready = ensureJobTables(pool, tablePrefix, createTables);
  const clock = createStoreClock(async () => {
    const row = await selectOne<{ now: Numeric }>(pool, `SELECT ${NOW_MS} AS now`);

    return row ? Number(row.now) : Date.now();
  });

  const db = async (): Promise<Pool> => {
    await ready();

    return pool;
  };

  const expiryOf = (at: number): number => at + retentionDays * DAY_MS;

  let purgedAt = 0;
  const purge = async (at: number): Promise<void> => {
    if (at - purgedAt < PURGE_EVERY_MS) {
      return;
    }

    purgedAt = at;
    await execute(pool, `DELETE FROM ${t.jobs} WHERE expires_at IS NOT NULL AND expires_at < ? LIMIT 1000`, [at]);
  };

  const inSpaces = (spaceIds: number[]) => spaceIds.length > 0;

  return {
    resyncClock: clock.resync,

    now: async () => new Date(await clock.now()),

    enqueue: async (job: JobInput) => {
      const conn = await db();
      const at = await clock.now();
      try {
        await execute(
          conn,
          `INSERT INTO ${t.jobs} (id, space_id, target_kind, target_name, target, environment, input, due_at,
            max_attempts, missed, job_key, needs_memory_mb, status, run_at, attempts, created_at, updated_at, history)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 0, ?, ?, '[]')`,
          [
            job.id,
            job.spaceId,
            job.target.kind,
            job.target.name,
            JSON.stringify(job.target),
            job.environment,
            JSON.stringify(job.input),
            job.dueAt,
            job.maxAttempts,
            job.missed ?? null,
            job.key ?? null,
            job.needsMemoryMb ?? null,
            // The fire's own instant, so a job produced late is still claimable at once rather than waiting again.
            job.dueAt,
            at,
            at
          ]
        );

        return true;
      } catch (error) {
        // The id is the fire, so a second replica reaching the same fire lands here. It is the guarantee working.
        if ((error as { code?: string }).code === DUPLICATE_ENTRY) {
          return false;
        }

        throw error;
      }
    },

    claim: async ({ workerId, leaseMs, limit, spaces, memory }) => {
      const conn = await db();
      const at = await clock.now();
      const taken: Job[] = [];

      // Reaped first, whoever claims: a lapsed lease is a worker that died, and its attempt is written for it — so a
      // replica that keeps dying shows. Each row by a compare-and-set on the version read, so it is reaped once.
      const lapsed = await selectRows<JobRow>(
        conn,
        `SELECT * FROM ${t.jobs} WHERE status = 'running' AND lease_until < ? ORDER BY run_at LIMIT ?`,
        [at, REAP_ROWS]
      );
      for (const row of lapsed) {
        const job = toJob(row);
        const holderMb = job.holderMemoryMb;
        const outgrew = outgrewWorker(job);
        const history: JobAttempt[] = [
          ...job.history,
          {
            attempt: job.history.length + 1,
            status: 'lost',
            startedAt: job.updatedAt,
            endedAt: at,
            workerId: job.workerId ?? 'unknown',
            error: LOST_ERROR,
            ...(holderMb === undefined ? {} : { memoryMb: holderMb }),
            ...(job.nearMemoryLimit ? { nearMemoryLimit: job.nearMemoryLimit } : {})
          }
        ];
        await execute(
          conn,
          `UPDATE ${t.jobs} SET status = 'pending', worker_id = NULL, lease_until = NULL, holder_memory_mb = NULL,
            near_memory_limit = 0, needs_memory_mb = ?, error = ?, history = ?, updated_at = ?
          WHERE id = ? AND status = 'running' AND updated_at = ? AND lease_until < ?`,
          [
            needsAfterLoss(job.needsMemoryMb, holderMb, outgrew) ?? null,
            lostError(holderMb, outgrew),
            JSON.stringify(history),
            at,
            job.id,
            job.updatedAt,
            at
          ]
        );
      }

      if (memory) {
        await execute(
          conn,
          `UPDATE ${t.jobs} SET status = 'paused', error = CONCAT(?, needs_memory_mb - 1, ?, ?, ?), updated_at = ?
          WHERE status = 'pending' AND needs_memory_mb > ?`,
          [...SET_ASIDE_WORDS.slice(0, 2), String(memory.ceilingMb), SET_ASIDE_WORDS[2], at, memory.ceilingMb]
        );
      }

      /**
       * Read, then take each job with ONE single-row update that only lands if the row is still the version that was
       * read — due, waiting, and not written since. Two workers reading the same candidates each get the rows they
       * win and skip the rest.
       *
       * Not `SELECT … FOR UPDATE SKIP LOCKED` in a transaction: the locks that takes on the status index cross with
       * the ones the updates need, and two replicas claiming at once deadlock. A single-row update by primary key
       * holds one lock and cannot.
       */
      for (let round = 0; round < CLAIM_ROUNDS && taken.length < limit; round += 1) {
        const where = claimable(at, spaces, memory?.takesNeeding === false ? undefined : memory?.mb);
        const rows = await selectRows<JobRow>(
          conn,
          `SELECT * FROM ${t.jobs} WHERE ${where.sql} ORDER BY run_at LIMIT ?`,
          [...where.params, limit - taken.length]
        );
        if (rows.length === 0) {
          break;
        }

        for (const row of rows) {
          const job = toJob(row);
          const won = await execute(
            conn,
            `UPDATE ${t.jobs} SET status = 'running', worker_id = ?, lease_until = ?, updated_at = ?,
              attempts = attempts + 1, holder_memory_mb = ?, near_memory_limit = 0
            WHERE id = ? AND status = 'pending' AND updated_at = ? AND attempts = ? AND run_at <= ?`,
            [workerId, at + leaseMs, at, memory?.mb ?? null, job.id, job.updatedAt, job.attempts, at]
          );
          if (won.affectedRows !== 1) {
            continue;
          }

          taken.push({
            ...job,
            status: 'running',
            workerId,
            leaseUntil: at + leaseMs,
            updatedAt: at,
            attempts: job.attempts + 1,
            ...(memory ? { holderMemoryMb: memory.mb } : {})
          });
        }
      }

      return taken;
    },

    heartbeat: async ({ jobIds, workerId, leaseMs, nearMemoryLimit }) => {
      if (jobIds.length === 0) {
        return [];
      }

      const conn = await db();
      const at = await clock.now();
      await execute(
        conn,
        `UPDATE ${t.jobs} SET lease_until = ?${nearMemoryLimit ? ', near_memory_limit = 1' : ''}
          WHERE id IN (?) AND worker_id = ? AND status = 'running'`,
        [at + leaseMs, jobIds, workerId]
      );

      const stopping = await selectRows<{ id: string; cancel_requested: Numeric }>(
        conn,
        `SELECT id, cancel_requested FROM ${t.jobs} WHERE id IN (?) AND worker_id = ? AND status = 'running'
          AND (cancel_requested = 1 OR pause_requested = 1)`,
        [jobIds, workerId]
      );

      // A cancel wins over a pause asked of the same job: set aside, it would only wait to be dropped.
      return stopping.map(row => ({
        jobId: row.id,
        stop: (Number(row.cancel_requested) === 1 ? 'cancel' : 'pause') satisfies JobStop
      }));
    },

    write: async ({ jobId, workerId, state, progress }: JobWrite) => {
      const conn = await db();
      const at = await clock.now();
      const sets = [
        'updated_at = ?',
        ...(state === undefined ? [] : ['state = ?']),
        ...(progress ? ['progress = ?'] : [])
      ];
      const written = await execute(
        conn,
        `UPDATE ${t.jobs} SET ${sets.join(', ')} WHERE id = ? AND worker_id = ? AND status = 'running'`,
        [
          at,
          ...(state === undefined ? [] : [JSON.stringify(state)]),
          ...(progress ? [JSON.stringify({ ...progress, at })] : []),
          jobId,
          workerId
        ]
      );

      return written.affectedRows === 1;
    },

    settle: async ({
      jobId,
      workerId,
      status,
      delayMs,
      runId,
      error,
      attempt,
      result,
      spentMs,
      refund = status === 'pending' && !attempt
    }: JobSettlement) => {
      await db();
      const at = await clock.now();

      await transaction(pool, async connection => {
        // Scoped to the holder: a settlement from a worker whose lease already lapsed is a report about a job
        // somebody else now owns, and writing it would overwrite a live attempt with a stale verdict.
        const row = await selectOne<JobRow>(
          connection,
          `SELECT * FROM ${t.jobs} WHERE id = ? AND worker_id = ? FOR UPDATE`,
          [jobId, workerId]
        );
        if (!row) {
          return;
        }

        const job = toJob(row);
        const history = attempt
          ? [...job.history, { ...attempt, attempt: job.history.length + 1, startedAt: job.updatedAt, endedAt: at }]
          : job.history;
        // Asked to stop while it was settling: the next slice it was handed back for is what that stop was about.
        const settled =
          status === 'pending' && job.cancelRequested
            ? 'cancelled'
            : status === 'pending' && job.pauseRequested
              ? 'paused'
              : status;
        // Handed back untouched, or a slice that did not fail: the attempt it took is given back too.
        const attempts = refund ? Math.max(0, job.attempts - 1) : job.attempts;
        const waiting = settled === 'pending' || settled === 'paused';

        await execute(
          connection,
          `UPDATE ${t.jobs} SET status = ?, updated_at = ?, lease_until = NULL, error = ?, run_id = COALESCE(?, run_id),
            run_at = ?, worker_id = ?, attempts = ?, history = ?, expires_at = ?, cancel_requested = 0,
            pause_requested = 0, result = COALESCE(?, result), active_ms = active_ms + ? WHERE id = ?`,
          [
            settled,
            at,
            error ?? null,
            runId ?? null,
            settled === 'pending' ? at + (delayMs ?? 0) : job.runAt,
            waiting ? null : workerId,
            attempts,
            JSON.stringify(history),
            TERMINAL.includes(settled) ? expiryOf(at) : null,
            jsonOrNull(result),
            spentMs ?? 0,
            jobId
          ]
        );
      });

      await purge(at);
    },

    dueSchedules: async limit => {
      const conn = await db();
      const at = await clock.now();
      const rows = await selectRows<ScheduleRow>(
        conn,
        `SELECT * FROM ${t.schedules} WHERE enabled = 1 AND next_run_at <= ? ORDER BY next_run_at LIMIT ?`,
        [at, limit]
      );

      return rows.map(toSchedule);
    },

    advanceSchedule: async ({ spaceId, actionId, from, to, missed }) => {
      const conn = await db();
      const at = await clock.now();
      // Compare-and-set on the very value that was read: two replicas that swept the same fire cannot both move it.
      const result = await execute(
        conn,
        `UPDATE ${t.schedules} SET next_run_at = ?, last_fire_at = ?, updated_at = ?, missed = missed + ?
        WHERE space_id = ? AND action_id = ? AND next_run_at = ?`,
        [to, from, at, missed, spaceId, actionId, from]
      );

      return result.affectedRows === 1;
    },

    putSchedules: async ({ spaceId, schedules: incoming }) => {
      await db();
      const at = await clock.now();

      await transaction(pool, async connection => {
        for (const schedule of incoming) {
          /**
           * `next_run_at` FIRST: MySQL applies these assignments left to right, each seeing the ones before it, so
           * the comparison has to read the old expression before `cron` is overwritten. A fire already promised for
           * an unchanged expression is kept — recomputing it on every save would push a busy space's schedule forward
           * forever. `VALUES()` rather than a row alias, which MariaDB does not have.
           */
          await execute(
            connection,
            `INSERT INTO ${t.schedules} (space_id, action_id, cron, timezone, environment, enabled, next_run_at,
              missed, max_attempts, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
            ON DUPLICATE KEY UPDATE
              next_run_at = IF(cron = VALUES(cron) AND timezone <=> VALUES(timezone)
                AND environment = VALUES(environment), next_run_at, VALUES(next_run_at)),
              cron = VALUES(cron), timezone = VALUES(timezone), environment = VALUES(environment),
              enabled = VALUES(enabled), max_attempts = VALUES(max_attempts), updated_at = VALUES(updated_at)`,
            [
              spaceId,
              schedule.actionId,
              schedule.cron,
              schedule.timezone ?? null,
              schedule.environment,
              schedule.enabled ? 1 : 0,
              schedule.nextRunAt,
              schedule.maxAttempts,
              at
            ]
          );
        }

        // An action that stopped declaring a schedule stops having one — in this space, never another.
        const kept = incoming.map(schedule => schedule.actionId);
        await execute(
          connection,
          kept.length > 0
            ? `DELETE FROM ${t.schedules} WHERE space_id = ? AND action_id NOT IN (?)`
            : `DELETE FROM ${t.schedules} WHERE space_id = ?`,
          kept.length > 0 ? [spaceId, kept] : [spaceId]
        );
      });
    },

    listJobs: async ({ spaceIds, name, status, kind, limit, offset }: JobQuery) => {
      if (!inSpaces(spaceIds)) {
        return { jobs: [], total: 0 };
      }

      const conn = await db();
      const where = [
        'space_id IN (?)',
        ...(name ? ['target_name = ?'] : []),
        ...(status ? ['status = ?'] : []),
        ...(kind ? ['target_kind = ?'] : [])
      ].join(' AND ');
      const params: unknown[] = [
        spaceIds,
        ...(name ? [name] : []),
        ...(status ? [status] : []),
        ...(kind ? [kind] : [])
      ];

      const [rows, count] = await Promise.all([
        selectRows<JobRow>(
          conn,
          `SELECT * FROM ${t.jobs} WHERE ${where} ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?`,
          [...params, limit, offset]
        ),
        selectOne<{ total: Numeric }>(conn, `SELECT COUNT(*) AS total FROM ${t.jobs} WHERE ${where}`, params)
      ]);

      return { jobs: rows.map(toJob), total: Number(count?.total ?? 0) };
    },

    countDue: async ({ spaces, memoryMb } = {}) => {
      const conn = await db();
      const where = claimable(await clock.now(), spaces, memoryMb);
      const row = await selectOne<{ n: Numeric }>(
        conn,
        `SELECT COUNT(*) AS n FROM ${t.jobs} WHERE ${where.sql}`,
        where.params
      );

      return Number(row?.n ?? 0);
    },

    listAcross: async ({ statuses, limit, order }) => {
      if (statuses.length === 0) {
        return [];
      }

      const rows = await selectRows<JobRow>(
        await db(),
        `SELECT * FROM ${t.jobs} WHERE status IN (?) ORDER BY ${order === 'due' ? 'run_at ASC' : 'updated_at DESC'}, id LIMIT ?`,
        [statuses, limit]
      );

      return rows.map(toJob);
    },

    summarize: async ({ spaces = 10 } = {}) => summarizeJobsTable(await db(), t.jobs, spaces),

    flow: async ({ from, to }) => {
      type FlowRow = Pick<JobRow, 'due_at' | 'history' | 'status' | 'updated_at' | 'attempts'>;
      const rows = await selectRows<FlowRow>(
        await db(),
        `SELECT due_at, history, status, updated_at, attempts FROM ${t.jobs}
        WHERE (due_at >= ? AND due_at < ?) OR updated_at >= ?`,
        [from, to, from]
      );

      return flowOf(
        rows.map(row => ({
          dueAt: Number(row.due_at),
          // Written by this queue alone, as a job's attempts: read back as them.
          history: JSON.parse(row.history) as JobAttempt[],
          status: row.status as JobStatus,
          updatedAt: Number(row.updated_at),
          attempts: Number(row.attempts)
        })),
        from,
        to
      );
    },

    getJob: async (spaceIds, jobId) => {
      if (!inSpaces(spaceIds)) {
        return undefined;
      }

      const row = await selectOne<JobRow>(await db(), `SELECT * FROM ${t.jobs} WHERE id = ? AND space_id IN (?)`, [
        jobId,
        spaceIds
      ]);

      return row ? toJob(row) : undefined;
    },

    listSchedules: async spaceIds => {
      if (!inSpaces(spaceIds)) {
        return [];
      }

      const rows = await selectRows<ScheduleRow>(
        await db(),
        `SELECT * FROM ${t.schedules} WHERE space_id IN (?) ORDER BY next_run_at`,
        [spaceIds]
      );

      return rows.map(toSchedule);
    },

    requeue: async (spaceIds, jobId, { input, fresh = false } = {}) => {
      if (!inSpaces(spaceIds)) {
        return false;
      }

      const conn = await db();
      const at = await clock.now();
      // Any finished job, including one that went fine; the history is kept — it is why somebody is looking.
      const result = await execute(
        conn,
        `UPDATE ${t.jobs} SET status = 'pending', run_at = ?, attempts = 0, updated_at = ?, cancel_requested = 0,
          pause_requested = 0, worker_id = NULL, lease_until = NULL, error = NULL, expires_at = NULL, result = NULL
          ${input ? ', input = ?' : ''}${fresh ? ', state = NULL, progress = NULL, active_ms = 0' : ''}
        WHERE id = ? AND space_id IN (?) AND status IN (?)`,
        [at, at, ...(input ? [JSON.stringify(input)] : []), jobId, spaceIds, TERMINAL]
      );

      return result.affectedRows === 1;
    },

    cancel: async (spaceIds, jobId) => {
      if (!inSpaces(spaceIds)) {
        return false;
      }

      const conn = await db();
      const at = await clock.now();
      const dropped = await execute(
        conn,
        `UPDATE ${t.jobs} SET status = 'cancelled', updated_at = ?, expires_at = ?, worker_id = NULL, pause_requested = 0
        WHERE id = ? AND space_id IN (?) AND status IN ('pending', 'paused')`,
        [at, expiryOf(at), jobId, spaceIds]
      );
      if (dropped.affectedRows === 1) {
        return true;
      }

      // Running: only the replica holding it can stop the flow, so the request is left where its heartbeat reads it.
      const flagged = await execute(
        conn,
        `UPDATE ${t.jobs} SET cancel_requested = 1, updated_at = ? WHERE id = ? AND space_id IN (?) AND status = 'running'`,
        [at, jobId, spaceIds]
      );

      return flagged.affectedRows === 1;
    },

    pause: async (spaceIds, jobId) => {
      if (!inSpaces(spaceIds)) {
        return false;
      }

      const conn = await db();
      const at = await clock.now();
      // Only a job of the space's functions saves where it is: a flow set aside would only start again from nothing.
      const waiting = await execute(
        conn,
        `UPDATE ${t.jobs} SET status = 'paused', updated_at = ?
        WHERE id = ? AND space_id IN (?) AND target_kind = 'function' AND status = 'pending'`,
        [at, jobId, spaceIds]
      );
      if (waiting.affectedRows === 1) {
        return true;
      }

      const flagged = await execute(
        conn,
        `UPDATE ${t.jobs} SET pause_requested = 1, updated_at = ?
        WHERE id = ? AND space_id IN (?) AND target_kind = 'function' AND status = 'running' AND pause_requested = 0`,
        [at, jobId, spaceIds]
      );

      return flagged.affectedRows === 1;
    },

    resume: async (spaceIds, jobId) => {
      if (!inSpaces(spaceIds)) {
        return false;
      }

      const conn = await db();
      const at = await clock.now();
      const resumed = await execute(
        conn,
        `UPDATE ${t.jobs} SET status = 'pending', run_at = ?, updated_at = ?,
          attempts = IF(attempts >= max_attempts, 0, attempts)
        WHERE id = ? AND space_id IN (?) AND status = 'paused'`,
        [at, at, jobId, spaceIds]
      );

      return resumed.affectedRows === 1;
    },

    cancelPending: async ({ spaceId, key, olderThan }) => {
      const conn = await db();
      const newest =
        olderThan === undefined
          ? undefined
          : await selectOne<Pick<JobRow, 'id' | 'created_at'>>(
              conn,
              `SELECT id, created_at FROM ${t.jobs} WHERE id = ?`,
              [olderThan]
            );
      const at = await clock.now();
      const dropped = await execute(
        conn,
        `UPDATE ${t.jobs} SET status = 'cancelled', updated_at = ?, expires_at = ?, worker_id = NULL
        WHERE space_id = ? AND job_key = ? AND status = 'pending'${newest ? ' AND (created_at < ? OR (created_at = ? AND id < ?))' : ''}`,
        [at, expiryOf(at), spaceId, key, ...(newest ? [newest.created_at, newest.created_at, newest.id] : [])]
      );

      return dropped.affectedRows;
    }
  };
};
