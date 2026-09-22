import { integer, optionalInteger, optionalText, placeholders, storeNow, text, transaction } from './database';

import type { Row } from './database';
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
import type { DatabaseSync } from 'node:sqlite';

/**
 * The job queue, written out in full over SQLite — the seam a self-hosted deployment fills.
 *
 * `sdk-server` ships a queue in memory, which is right for exactly one process: stop it and every waiting job is
 * gone, start a second and each keeps its own schedules, so the nightly email goes out twice. This is the same
 * contract over a file, and the four rules the contract cannot be written without are each one place below:
 *
 * | Rule | Where |
 * |---|---|
 * | Every instant comes from the store | `storeNow` — never `Date.now()`, and `settle`/`claim` take durations |
 * | `enqueue` is idempotent by id | `ON CONFLICT (id) DO NOTHING`, answering whether it inserted |
 * | `claim` is atomic, and it reaps | one `BEGIN IMMEDIATE` that takes due jobs AND jobs whose lease lapsed |
 * | `advanceSchedule` is compare-and-set | `WHERE next_run_at = from` |
 *
 * Against Postgres the same shape is `SELECT … FOR UPDATE SKIP LOCKED`; against Mongo, `findOneAndUpdate`. The
 * rules do not change with the store.
 */

const TERMINAL: ActionJobStatus[] = ['succeeded', 'failed', 'dead', 'cancelled'];
const STATUSES: ActionJobStatus[] = ['pending', 'running', ...TERMINAL];
const ENVIRONMENTS: Environment[] = ['production', 'staging', 'development', 'main'];
const TRIGGERS: ActionTriggerType[] = ['call', 'webhook', 'schedule', 'render', 'custom'];
const ATTEMPT_STATUSES: ActionJobAttempt['status'][] = ['succeeded', 'failed', 'cancelled', 'lost'];

const oneOf = <T extends string>(allowed: readonly T[], value: string, what: string): T => {
  const found = allowed.find(candidate => candidate === value);
  if (!found) {
    throw new Error(`The store holds an unknown ${what}: "${value}"`);
  }

  return found;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseInput = (raw: string): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(raw);

  return isRecord(parsed) ? parsed : {};
};

const parseHistory = (raw: string): ActionJobAttempt[] => {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter(isRecord).map(entry => ({
    attempt: Number(entry.attempt),
    status: oneOf(ATTEMPT_STATUSES, String(entry.status), 'attempt status'),
    startedAt: Number(entry.startedAt),
    endedAt: Number(entry.endedAt),
    workerId: String(entry.workerId),
    ...(typeof entry.runId === 'string' ? { runId: entry.runId } : {}),
    ...(typeof entry.error === 'string' ? { error: entry.error } : {})
  }));
};

const toJob = (row: Row): ActionJob => {
  const missed = optionalInteger(row, 'missed');
  const leaseUntil = optionalInteger(row, 'lease_until');
  const workerId = optionalText(row, 'worker_id');
  const runId = optionalText(row, 'run_id');
  const error = optionalText(row, 'error');

  return {
    id: text(row, 'id'),
    spaceId: integer(row, 'space_id'),
    actionId: text(row, 'action_id'),
    environment: oneOf(ENVIRONMENTS, text(row, 'environment'), 'environment'),
    trigger: oneOf(TRIGGERS, text(row, 'trigger_type'), 'trigger'),
    input: parseInput(text(row, 'input')),
    dueAt: integer(row, 'due_at'),
    maxAttempts: integer(row, 'max_attempts'),
    status: oneOf(STATUSES, text(row, 'status'), 'job status'),
    runAt: integer(row, 'run_at'),
    attempts: integer(row, 'attempts'),
    cancelRequested: integer(row, 'cancel_requested') === 1,
    createdAt: integer(row, 'created_at'),
    updatedAt: integer(row, 'updated_at'),
    history: parseHistory(text(row, 'history')),
    ...(missed === undefined ? {} : { missed }),
    ...(leaseUntil === undefined ? {} : { leaseUntil }),
    ...(workerId === undefined ? {} : { workerId }),
    ...(runId === undefined ? {} : { runId }),
    ...(error === undefined ? {} : { error })
  };
};

const toSchedule = (row: Row): ActionSchedule => {
  const timezone = optionalText(row, 'timezone');
  const lastFireAt = optionalInteger(row, 'last_fire_at');

  return {
    spaceId: integer(row, 'space_id'),
    actionId: text(row, 'action_id'),
    cron: text(row, 'cron'),
    environment: oneOf(ENVIRONMENTS, text(row, 'environment'), 'environment'),
    enabled: integer(row, 'enabled') === 1,
    nextRunAt: integer(row, 'next_run_at'),
    missed: integer(row, 'missed'),
    maxAttempts: integer(row, 'max_attempts'),
    updatedAt: integer(row, 'updated_at'),
    ...(timezone === undefined ? {} : { timezone }),
    ...(lastFireAt === undefined ? {} : { lastFireAt })
  };
};

/**
 * Numbered by the history itself, not by `attempts`: an operator who runs a finished job again starts its attempt
 * count over, and the record of what was already tried must not start over with it.
 */
const withAttempt = (history: ActionJobAttempt[], attempt: Omit<ActionJobAttempt, 'attempt'>): string =>
  JSON.stringify([...history, { ...attempt, attempt: history.length + 1 }]);

export type SqliteJobQueueOptions = {
  /**
   * How many finished jobs are kept before the oldest are deleted.
   *
   * A bound rather than an age, because this is a demo that should never need cleaning up. A real deployment keeps
   * finished jobs for as long as somebody might want to run one again — Plitzi's own keeps them 90 days.
   */
  retainFinished?: number;
};

export const createSqliteJobQueue = (
  db: DatabaseSync,
  { retainFinished = 200 }: SqliteJobQueueOptions = {}
): ActionJobQueue => {
  const now = () => storeNow(db);

  const prune = () => {
    db.prepare(
      `DELETE FROM jobs WHERE id IN (
         SELECT id FROM jobs WHERE status IN (${placeholders(TERMINAL)}) ORDER BY updated_at DESC LIMIT -1 OFFSET ?
       )`
    ).run(...TERMINAL, retainFinished);
  };

  const findJob = (jobId: string): ActionJob | undefined => {
    const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);

    return row ? toJob(row) : undefined;
  };

  /** A job the caller may act on: it exists AND belongs to one of the spaces the caller answers for. */
  const owned = (spaceIds: number[], jobId: string): ActionJob | undefined => {
    const job = findJob(jobId);

    return job && spaceIds.includes(job.spaceId) ? job : undefined;
  };

  const enqueue = (job: ActionJobInput): boolean => {
    const at = now();
    const { changes } = db
      .prepare(
        `INSERT INTO jobs (id, space_id, action_id, environment, trigger_type, input, due_at, max_attempts, missed,
                           status, run_at, attempts, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 0, ?, ?)
         ON CONFLICT (id) DO NOTHING`
      )
      .run(
        job.id,
        job.spaceId,
        job.actionId,
        job.environment,
        job.trigger,
        JSON.stringify(job.input),
        job.dueAt,
        job.maxAttempts,
        job.missed ?? null,
        job.dueAt,
        at,
        at
      );
    prune();

    return changes === 1;
  };

  const claim = ({ workerId, leaseMs, limit }: { workerId: string; leaseMs: number; limit: number }): ActionJob[] =>
    transaction(db, () => {
      const at = now();
      const due = db
        .prepare(
          `SELECT * FROM jobs
           WHERE (status = 'pending' AND run_at <= ?) OR (status = 'running' AND lease_until < ?)
           ORDER BY run_at LIMIT ?`
        )
        .all(at, at, limit)
        .map(toJob);

      const take = db.prepare(
        `UPDATE jobs SET status = 'running', attempts = attempts + 1, worker_id = ?, lease_until = ?, updated_at = ?,
                         history = ?
         WHERE id = ?`
      );

      return due.map(job => {
        /**
         * The previous holder never came back, so its attempt is written for it. Without this a replica that died
         * mid-run leaves a job that simply starts again, with nothing anywhere saying it had been tried.
         */
        const history =
          job.status === 'running'
            ? withAttempt(job.history, {
                status: 'lost',
                startedAt: job.updatedAt,
                endedAt: at,
                workerId: job.workerId ?? 'unknown',
                error: 'the worker holding this job stopped reporting'
              })
            : JSON.stringify(job.history);
        take.run(workerId, at + leaseMs, at, history, job.id);

        return {
          ...job,
          status: 'running' as const,
          attempts: job.attempts + 1,
          workerId,
          leaseUntil: at + leaseMs,
          updatedAt: at,
          history: parseHistory(history)
        };
      });
    });

  /** Renews what this worker still holds, and answers which of those an operator asked to stop. */
  const heartbeat = ({ jobIds, workerId, leaseMs }: { jobIds: string[]; workerId: string; leaseMs: number }) => {
    const at = now();
    const renew = db.prepare(
      `UPDATE jobs SET lease_until = ? WHERE id = ? AND worker_id = ? AND status = 'running'
       RETURNING cancel_requested`
    );

    return jobIds.filter(jobId => {
      const row = renew.get(at + leaseMs, jobId, workerId);

      return row !== undefined && integer(row, 'cancel_requested') === 1;
    });
  };

  const settle = ({ jobId, workerId, status, delayMs, runId, error, attempt }: ActionJobSettlement): void => {
    transaction(db, () => {
      const job = findJob(jobId);
      /**
       * A settlement from a worker that no longer holds the job is a report from the past: its lease lapsed, the
       * job was taken over, and whoever holds it now owns the outcome. Dropping it is what stops a stalled replica
       * from overwriting a live attempt with a stale verdict.
       */
      if (!job || job.workerId !== workerId) {
        return;
      }

      const at = now();
      const history = attempt
        ? withAttempt(job.history, { ...attempt, startedAt: job.updatedAt, endedAt: at })
        : JSON.stringify(job.history);
      const backToQueue = status === 'pending';
      // Handed back untouched — the worker never got to run it — so the attempt it took is given back too.
      const attempts = backToQueue && !attempt ? Math.max(0, job.attempts - 1) : job.attempts;

      db.prepare(
        `UPDATE jobs SET status = ?, updated_at = ?, lease_until = NULL, error = ?, run_id = COALESCE(?, run_id),
                         history = ?, attempts = ?, run_at = ?, worker_id = ?
         WHERE id = ?`
      ).run(
        status,
        at,
        error ?? null,
        runId ?? null,
        history,
        attempts,
        backToQueue ? at + (delayMs ?? 0) : job.runAt,
        backToQueue ? null : workerId,
        jobId
      );
    });
    prune();
  };

  const dueSchedules = (limit: number): ActionSchedule[] =>
    db
      .prepare('SELECT * FROM schedules WHERE enabled = 1 AND next_run_at <= ? ORDER BY next_run_at LIMIT ?')
      .all(now(), limit)
      .map(toSchedule);

  const advanceSchedule = ({
    spaceId,
    actionId,
    from,
    to,
    missed
  }: {
    spaceId: number;
    actionId: string;
    from: number;
    to: number;
    missed: number;
  }): boolean => {
    const { changes } = db
      .prepare(
        `UPDATE schedules SET next_run_at = ?, last_fire_at = ?, missed = missed + ?, updated_at = ?
         WHERE space_id = ? AND action_id = ? AND next_run_at = ?`
      )
      .run(to, from, missed, now(), spaceId, actionId, from);

    return changes === 1;
  };

  const putSchedules = ({ spaceId, schedules }: Parameters<ActionJobQueue['putSchedules']>[0]): void => {
    transaction(db, () => {
      const at = now();
      const kept = schedules.map(schedule => schedule.actionId);
      db.prepare(`DELETE FROM schedules WHERE space_id = ? AND action_id NOT IN (${placeholders(kept)})`).run(
        spaceId,
        ...kept
      );

      /**
       * An existing schedule keeps its own `next_run_at` while its cron, zone and environment are unchanged: that
       * instant is a fire already promised. Recomputing it on every reconcile would move it forward each time —
       * and after an outage it would quietly skip the fire that was owed, which the sweep is there to produce.
       */
      const upsert = db.prepare(
        `INSERT INTO schedules (space_id, action_id, cron, timezone, environment, enabled, next_run_at, max_attempts,
                                updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (space_id, action_id) DO UPDATE SET
           next_run_at = CASE
             WHEN schedules.cron = excluded.cron AND schedules.timezone IS excluded.timezone
                  AND schedules.environment = excluded.environment
             THEN schedules.next_run_at ELSE excluded.next_run_at END,
           cron = excluded.cron, timezone = excluded.timezone, environment = excluded.environment,
           enabled = excluded.enabled, max_attempts = excluded.max_attempts, updated_at = excluded.updated_at`
      );
      for (const schedule of schedules) {
        upsert.run(
          spaceId,
          schedule.actionId,
          schedule.cron,
          schedule.timezone ?? null,
          schedule.environment,
          schedule.enabled ? 1 : 0,
          schedule.nextRunAt,
          schedule.maxAttempts,
          at
        );
      }
    });
  };

  const listJobs = ({ spaceIds, actionId, status, limit, offset }: ActionJobQuery) => {
    const filters = [`space_id IN (${placeholders(spaceIds)})`];
    const values: (string | number)[] = [...spaceIds];
    if (actionId !== undefined) {
      filters.push('action_id = ?');
      values.push(actionId);
    }

    if (status !== undefined) {
      filters.push('status = ?');
      values.push(status);
    }

    const where = filters.join(' AND ');
    const total = integer(
      db.prepare(`SELECT COUNT(*) AS total FROM jobs WHERE ${where}`).get(...values) ?? {},
      'total'
    );
    const jobs = db
      .prepare(`SELECT * FROM jobs WHERE ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`)
      .all(...values, limit, offset)
      .map(toJob);

    return { jobs, total };
  };

  const listSchedules = (spaceIds: number[]): ActionSchedule[] =>
    db
      .prepare(`SELECT * FROM schedules WHERE space_id IN (${placeholders(spaceIds)}) ORDER BY next_run_at`)
      .all(...spaceIds)
      .map(toSchedule);

  /** Any job that has stopped, including one that went fine: re-sending last night's digest is the ordinary case. */
  const requeue = (spaceIds: number[], jobId: string): boolean => {
    const job = owned(spaceIds, jobId);
    if (!job || !TERMINAL.includes(job.status)) {
      return false;
    }

    const at = now();
    db.prepare(
      `UPDATE jobs SET status = 'pending', run_at = ?, attempts = 0, worker_id = NULL, lease_until = NULL,
                       cancel_requested = 0, error = NULL, updated_at = ?
       WHERE id = ?`
    ).run(at, at, jobId);

    return true;
  };

  /**
   * A waiting job is dropped; a running one is FLAGGED, because the only thing that can stop a flow is the worker
   * holding it — and that worker may be another process. It reads the flag at its next heartbeat.
   */
  const cancel = (spaceIds: number[], jobId: string): boolean => {
    const job = owned(spaceIds, jobId);
    if (!job || TERMINAL.includes(job.status)) {
      return false;
    }

    const at = now();
    if (job.status === 'pending') {
      db.prepare("UPDATE jobs SET status = 'cancelled', worker_id = NULL, updated_at = ? WHERE id = ?").run(at, jobId);
    } else {
      db.prepare('UPDATE jobs SET cancel_requested = 1, updated_at = ? WHERE id = ?').run(at, jobId);
    }

    return true;
  };

  /**
   * The contract is asynchronous because most stores are; this one answers synchronously, so each method is wrapped
   * rather than rewritten. A throw still arrives as a rejection, which is what the scheduler and the worker expect.
   */
  const later =
    <A extends unknown[], R>(method: (...args: A) => R) =>
    (...args: A): Promise<R> => {
      try {
        return Promise.resolve(method(...args));
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
    };

  return {
    now: later(() => new Date(now())),
    enqueue: later(enqueue),
    claim: later(claim),
    heartbeat: later(heartbeat),
    settle: later(settle),
    dueSchedules: later(dueSchedules),
    advanceSchedule: later(advanceSchedule),
    putSchedules: later(putSchedules),
    listJobs: later(listJobs),
    getJob: later((spaceIds: number[], jobId: string) => owned(spaceIds, jobId)),
    listSchedules: later(listSchedules),
    requeue: later(requeue),
    cancel: later(cancel)
  };
};
