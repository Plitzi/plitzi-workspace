import type { ActionSchedule, JobSpaces } from '../types';
import type { Environment, Job, JobAttempt, JobProgress, JobStatus, JobTarget } from '@plitzi/sdk-shared';

/** The MySQL job queue's rows, as they are read and written, and what a claim takes (`jobQueue.ts`). */

export type Numeric = number | string;

export type JobRow = {
  id: string;
  space_id: Numeric;
  target_kind: string;
  target_name: string;
  target: string;
  environment: string;
  input: string;
  due_at: Numeric;
  max_attempts: Numeric;
  missed: Numeric | null;
  job_key: string | null;
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
  state: string | null;
  progress: string | null;
  result: string | null;
  pause_requested: Numeric;
  active_ms: Numeric;
  holder_memory_mb: Numeric | null;
  needs_memory_mb: Numeric | null;
  near_memory_limit: Numeric;
};

export type ScheduleRow = {
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
export const toJob = (row: JobRow): Job => ({
  id: row.id,
  spaceId: Number(row.space_id),
  // Written by this queue alone, from the job's own target: read back as what it was.
  target: JSON.parse(row.target) as JobTarget,
  environment: row.environment as Environment,
  input: JSON.parse(row.input) as Record<string, unknown>,
  dueAt: Number(row.due_at),
  maxAttempts: Number(row.max_attempts),
  ...(row.missed === null ? {} : { missed: Number(row.missed) }),
  ...(row.job_key === null ? {} : { key: row.job_key }),
  status: row.status as JobStatus,
  runAt: Number(row.run_at),
  attempts: Number(row.attempts),
  ...(row.lease_until === null ? {} : { leaseUntil: Number(row.lease_until) }),
  ...(row.worker_id === null ? {} : { workerId: row.worker_id }),
  ...(row.run_id === null ? {} : { runId: row.run_id }),
  ...(Number(row.cancel_requested) === 1 ? { cancelRequested: true } : {}),
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
  ...(row.error === null ? {} : { error: row.error }),
  history: JSON.parse(row.history) as JobAttempt[],
  ...(row.state === null ? {} : { state: JSON.parse(row.state) as unknown }),
  ...(row.progress === null ? {} : { progress: JSON.parse(row.progress) as JobProgress }),
  ...(row.result === null ? {} : { result: JSON.parse(row.result) as unknown }),
  ...(Number(row.pause_requested) === 1 ? { pauseRequested: true } : {}),
  ...(Number(row.active_ms) > 0 ? { activeMs: Number(row.active_ms) } : {}),
  ...(row.holder_memory_mb === null ? {} : { holderMemoryMb: Number(row.holder_memory_mb) }),
  ...(row.needs_memory_mb === null ? {} : { needsMemoryMb: Number(row.needs_memory_mb) }),
  ...(Number(row.near_memory_limit) === 1 ? { nearMemoryLimit: true } : {})
});

/** A value of a JSON column, or SQL's NULL for none. */
export const jsonOrNull = (value: unknown): string | null => (value === undefined ? null : JSON.stringify(value));

export const toSchedule = (row: ScheduleRow): ActionSchedule => ({
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

/**
 * What a claim with these `spaces` and `memoryMb` takes at `at`, as SQL: due and waiting, of its spaces — as many
 * placeholders as ids; an empty "only" takes none, an empty "except" every space — or a job a worker died running that
 * this one may hold, whatever its spaces.
 */
export const claimable = (
  at: number,
  spaces: JobSpaces | undefined,
  memoryMb: number | undefined,
  withoutCode = false
): { sql: string; params: (number | string)[] } => {
  const ids = spaces ? ('only' in spaces ? spaces.only : spaces.except) : [];
  const bySpace =
    !spaces || ids.length === 0
      ? spaces && 'only' in spaces
        ? ' AND FALSE'
        : ''
      : ` AND space_id ${'only' in spaces ? 'IN' : 'NOT IN'} (${ids.map(() => '?').join(', ')})`;

  return {
    sql: `status = 'pending' AND run_at <= ?${withoutCode ? " AND target_kind = 'action' AND JSON_EXTRACT(target, '$.code') IS NULL" : ''}
      AND ((needs_memory_mb IS NULL${bySpace})${memoryMb === undefined ? '' : ' OR needs_memory_mb <= ?'})`,
    params: [at, ...(bySpace.includes('?') ? ids : []), ...(memoryMb === undefined ? [] : [memoryMb])]
  };
};
