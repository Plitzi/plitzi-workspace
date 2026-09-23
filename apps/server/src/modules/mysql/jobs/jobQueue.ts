import { ensureJobTables, jobTables, NOW_MS } from './schema';
import { createStoreClock } from '../../actions/jobs/storeClock';
import { execute, selectOne, selectRows } from '../query';

import type {
  ActionJob,
  ActionJobAttempt,
  ActionJobInput,
  ActionJobQuery,
  ActionJobQueue,
  ActionJobSettlement,
  ActionJobStatus,
  ActionSchedule,
  ActionTriggerType,
  Environment
} from '@plitzi/sdk-shared';
import type { Pool, PoolConnection } from 'mysql2/promise';

const TERMINAL: ActionJobStatus[] = ['succeeded', 'failed', 'dead', 'cancelled'];

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

export type MysqlJobQueue = ActionJobQueue & {
  /** Takes the store's clock again on the next call — after a failover to another primary. */
  resyncClock: () => void;
};

type Numeric = number | string;

type JobRow = {
  id: string;
  space_id: Numeric;
  action_id: string;
  environment: string;
  trigger_type: string;
  input: string;
  due_at: Numeric;
  max_attempts: Numeric;
  missed: Numeric | null;
  status: string;
  run_at: Numeric;
  attempts: Numeric;
  lease_until: Numeric | null;
  worker_id: string | null;
  run_id: string | null;
  cancel_requested: Numeric;
  created_at: Numeric;
  updated_at: Numeric;
  error: string | null;
  history: string;
};

type ScheduleRow = {
  space_id: Numeric;
  action_id: string;
  cron: string;
  timezone: string | null;
  environment: string;
  enabled: Numeric;
  next_run_at: Numeric;
  last_fire_at: Numeric | null;
  missed: Numeric;
  max_attempts: Numeric;
  updated_at: Numeric;
};

/**
 * A row as the contract shapes it.
 *
 * `BIGINT` arrives as a number or as a string depending on how the deployment configured its pool
 * (`bigNumberStrings`), so every numeric column goes through `Number`. The text columns hold only what this queue
 * wrote into them — a status, an environment, a trigger — which is why they can be read back as those types.
 */
const toJob = (row: JobRow): ActionJob => ({
  id: row.id,
  spaceId: Number(row.space_id),
  actionId: row.action_id,
  environment: row.environment as Environment,
  trigger: row.trigger_type as ActionTriggerType,
  input: JSON.parse(row.input) as Record<string, unknown>,
  dueAt: Number(row.due_at),
  maxAttempts: Number(row.max_attempts),
  ...(row.missed === null ? {} : { missed: Number(row.missed) }),
  status: row.status as ActionJobStatus,
  runAt: Number(row.run_at),
  attempts: Number(row.attempts),
  ...(row.lease_until === null ? {} : { leaseUntil: Number(row.lease_until) }),
  ...(row.worker_id === null ? {} : { workerId: row.worker_id }),
  ...(row.run_id === null ? {} : { runId: row.run_id }),
  ...(Number(row.cancel_requested) === 1 ? { cancelRequested: true } : {}),
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
  ...(row.error === null ? {} : { error: row.error }),
  history: JSON.parse(row.history) as ActionJobAttempt[]
});

const toSchedule = (row: ScheduleRow): ActionSchedule => ({
  spaceId: Number(row.space_id),
  actionId: row.action_id,
  cron: row.cron,
  ...(row.timezone === null ? {} : { timezone: row.timezone }),
  environment: row.environment as Environment,
  enabled: Number(row.enabled) === 1,
  nextRunAt: Number(row.next_run_at),
  ...(row.last_fire_at === null ? {} : { lastFireAt: Number(row.last_fire_at) }),
  missed: Number(row.missed),
  maxAttempts: Number(row.max_attempts),
  updatedAt: Number(row.updated_at)
});

/** MySQL's answer when two transactions wait on each other: one is rolled back, and is meant to be run again. */
const DEADLOCK = 'ER_LOCK_DEADLOCK';
const TRANSACTION_ATTEMPTS = 3;

/** Claim rounds per call: a worker that lost every row it read to other workers looks once more, then waits a poll. */
const CLAIM_ROUNDS = 3;

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
 * An {@link ActionJobQueue} over tables in a MySQL database the deployment owns. Tested on MySQL 8; nothing in it
 * needs more than 5.7.
 *
 * The helper for a deployment that already runs MySQL: it borrows connections from the pool it is handed, and creates
 * its three tables on first use unless told not to. Every replica pointed at the same database shares the jobs and the
 * schedules.
 *
 * ```ts
 * import mysql from 'mysql2/promise';
 * import { createMysqlJobQueue, createMysqlKv } from '@plitzi/sdk-server/mysql';
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

    enqueue: async (job: ActionJobInput) => {
      const conn = await db();
      const at = await clock.now();
      try {
        await execute(
          conn,
          `INSERT INTO ${t.jobs} (id, space_id, action_id, environment, trigger_type, input, due_at, max_attempts,
            missed, status, run_at, attempts, created_at, updated_at, history)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 0, ?, ?, '[]')`,
          [
            job.id,
            job.spaceId,
            job.actionId,
            job.environment,
            job.trigger,
            JSON.stringify(job.input),
            job.dueAt,
            job.maxAttempts,
            job.missed ?? null,
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

    claim: async ({ workerId, leaseMs, limit }) => {
      const conn = await db();
      const at = await clock.now();
      const taken: ActionJob[] = [];

      /**
       * Read, then take each job with ONE single-row update that only lands if the row is still the version that was
       * read — due, unclaimed or with its lease still lapsed, and not written since. Two workers reading the same
       * candidates each get the rows they win and skip the rest.
       *
       * Not `SELECT … FOR UPDATE SKIP LOCKED` in a transaction: the locks that takes on the status index cross with
       * the ones the updates need, and two replicas claiming at once deadlock. A single-row update by primary key
       * holds one lock and cannot.
       */
      for (let round = 0; round < CLAIM_ROUNDS && taken.length < limit; round += 1) {
        const rows = await selectRows<JobRow>(
          conn,
          `SELECT * FROM ${t.jobs}
          WHERE (status = 'pending' AND run_at <= ?) OR (status = 'running' AND lease_until < ?)
          ORDER BY run_at LIMIT ?`,
          [at, at, limit - taken.length]
        );
        if (rows.length === 0) {
          break;
        }

        for (const row of rows) {
          const job = toJob(row);
          // A lapsed lease is a worker that died: its attempt is written for it, so a replica that keeps dying shows.
          const history: ActionJobAttempt[] =
            job.status === 'running'
              ? [
                  ...job.history,
                  {
                    attempt: job.history.length + 1,
                    status: 'lost',
                    startedAt: job.updatedAt,
                    endedAt: at,
                    workerId: job.workerId ?? 'unknown',
                    error: 'the worker holding this job stopped reporting'
                  }
                ]
              : job.history;

          const won = await execute(
            conn,
            `UPDATE ${t.jobs} SET status = 'running', worker_id = ?, lease_until = ?, updated_at = ?,
              attempts = attempts + 1, history = ?
            WHERE id = ? AND status = ? AND updated_at = ? AND attempts = ?
              AND ((status = 'pending' AND run_at <= ?) OR (status = 'running' AND lease_until < ?))`,
            [
              workerId,
              at + leaseMs,
              at,
              JSON.stringify(history),
              job.id,
              job.status,
              job.updatedAt,
              job.attempts,
              at,
              at
            ]
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
            history
          });
        }
      }

      return taken;
    },

    heartbeat: async ({ jobIds, workerId, leaseMs }) => {
      if (jobIds.length === 0) {
        return [];
      }

      const conn = await db();
      const at = await clock.now();
      await execute(
        conn,
        `UPDATE ${t.jobs} SET lease_until = ? WHERE id IN (?) AND worker_id = ? AND status = 'running'`,
        [at + leaseMs, jobIds, workerId]
      );

      const stopping = await selectRows<{ id: string }>(
        conn,
        `SELECT id FROM ${t.jobs} WHERE id IN (?) AND worker_id = ? AND status = 'running' AND cancel_requested = 1`,
        [jobIds, workerId]
      );

      return stopping.map(row => row.id);
    },

    settle: async ({ jobId, workerId, status, delayMs, runId, error, attempt }: ActionJobSettlement) => {
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
        const pending = status === 'pending';
        // Handed back untouched: the worker never got to run it, so the attempt it took is given back.
        const attempts = pending && !attempt ? Math.max(0, job.attempts - 1) : job.attempts;

        await execute(
          connection,
          `UPDATE ${t.jobs} SET status = ?, updated_at = ?, lease_until = NULL, error = ?, run_id = COALESCE(?, run_id),
            run_at = ?, worker_id = ?, attempts = ?, history = ?, expires_at = ? WHERE id = ?`,
          [
            status,
            at,
            error ?? null,
            runId ?? null,
            pending ? at + (delayMs ?? 0) : job.runAt,
            pending ? null : workerId,
            attempts,
            JSON.stringify(history),
            TERMINAL.includes(status) ? expiryOf(at) : null,
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

    listJobs: async ({ spaceIds, actionId, status, limit, offset }: ActionJobQuery) => {
      if (!inSpaces(spaceIds)) {
        return { jobs: [], total: 0 };
      }

      const conn = await db();
      const where = ['space_id IN (?)', ...(actionId ? ['action_id = ?'] : []), ...(status ? ['status = ?'] : [])].join(
        ' AND '
      );
      const params: unknown[] = [spaceIds, ...(actionId ? [actionId] : []), ...(status ? [status] : [])];

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

    requeue: async (spaceIds, jobId) => {
      if (!inSpaces(spaceIds)) {
        return false;
      }

      const conn = await db();
      const at = await clock.now();
      // Any finished job, including one that went fine; the history is kept — it is why somebody is looking.
      const result = await execute(
        conn,
        `UPDATE ${t.jobs} SET status = 'pending', run_at = ?, attempts = 0, updated_at = ?, cancel_requested = 0,
          worker_id = NULL, lease_until = NULL, error = NULL, expires_at = NULL
        WHERE id = ? AND space_id IN (?) AND status IN (?)`,
        [at, at, jobId, spaceIds, TERMINAL]
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
        `UPDATE ${t.jobs} SET status = 'cancelled', updated_at = ?, expires_at = ?, worker_id = NULL
        WHERE id = ? AND space_id IN (?) AND status = 'pending'`,
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
    }
  };
};
