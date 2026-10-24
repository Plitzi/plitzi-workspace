import { isTerminalJobStatus } from '@plitzi/sdk-shared/actions';

import type {
  Job,
  JobAttempt,
  JobInput,
  JobQuery,
  JobQueue,
  JobSettlement,
  JobStop,
  JobWrite,
  ActionSchedule
} from '@plitzi/sdk-shared';

/**
 * The queue's rules — what `enqueue`, `claim`, `settle`… do to the jobs and schedules — over a state handed to them,
 * kept apart from WHERE the state is: a process's Maps (`createMemoryJobQueue`), a JSON file (`createFileJobQueue`), a
 * SQLite table (`createSqliteJobQueue`). One set of rules, so a store kept anywhere keeps the contract to the letter: a
 * test that passes against one is testing all of them.
 */

/** The jobs and the schedules, by id: what a queue keeps. */
export type QueueState = { jobs: Map<string, Job>; schedules: Map<string, ActionSchedule> };

/** The queue's methods, answering at once: what each store wraps in its own way of reading and keeping the state. */
export type QueueRules = {
  [K in keyof JobQueue]: (...args: Parameters<JobQueue[K]>) => Awaited<ReturnType<JobQueue[K]>>;
};

/**
 * Whether a call changed the state, by its method and what it answered — what a store keeping the state elsewhere writes
 * back after. A worker claims every second: a claim that took nothing, a refused `write` or `cancel` change nothing, and
 * are not written.
 */
export const changedBy = <K extends keyof JobQueue>(method: K, answer: Awaited<ReturnType<JobQueue[K]>>): boolean => {
  switch (method) {
    case 'claim':
      return Array.isArray(answer) && answer.length > 0;
    case 'enqueue':
    case 'write':
    case 'advanceSchedule':
    case 'requeue':
    case 'cancel':
    case 'pause':
    case 'resume':
      return answer === true;
    case 'cancelPending':
      return typeof answer === 'number' && answer > 0;
    // A worker beats only for the jobs it holds: each extends a lease.
    case 'heartbeat':
    case 'settle':
    case 'putSchedules':
      return true;
    default:
      return false;
  }
};

/** What a schedule is kept by: its space and its action. */
export const scheduleKey = (spaceId: number, actionId: string): string => `${String(spaceId)}:${actionId}`;

export type QueueRulesOptions = {
  /** How many finished jobs to keep before the oldest are dropped. */
  retainFinished: number;
  /** What the queue calls now, in epoch ms: the one clock everything here reads. */
  clock: () => number;
};

export const queueRules = (
  { jobs, schedules }: QueueState,
  { retainFinished, clock }: QueueRulesOptions
): QueueRules => {
  const key = scheduleKey;
  const now = () => clock();

  /** Oldest finished jobs first, so the bound drops history rather than anything anybody is waiting on. */
  const evict = () => {
    const finished = [...jobs.values()]
      .filter(job => isTerminalJobStatus(job.status))
      .sort((a, b) => a.updatedAt - b.updatedAt);
    for (const job of finished.slice(0, finished.length - retainFinished)) {
      jobs.delete(job.id);
    }
  };

  const owned = (spaceIds: number[], jobId: string): Job | undefined => {
    const job = jobs.get(jobId);

    return job && spaceIds.includes(job.spaceId) ? job : undefined;
  };

  /** Numbered by the history itself, not by `attempts`: an operator who repeats a finished job starts its attempt
   *  count again, and the record of what has already been tried must not start again with it. */
  const appendAttempt = (job: Job, attempt: Omit<JobAttempt, 'attempt'>) => {
    job.history = [...job.history, { ...attempt, attempt: job.history.length + 1 }];
  };

  return {
    now: () => new Date(now()),

    enqueue: (job: JobInput) => {
      if (jobs.has(job.id)) {
        return false;
      }

      const at = now();
      jobs.set(job.id, {
        ...job,
        status: 'pending',
        runAt: job.dueAt,
        attempts: 0,
        createdAt: at,
        updatedAt: at,
        history: []
      });
      evict();

      return true;
    },

    claim: ({ workerId, leaseMs, limit }) => {
      const at = now();
      const taken: Job[] = [];
      const candidates = [...jobs.values()]
        .filter(
          job =>
            (job.status === 'pending' && job.runAt <= at) || (job.status === 'running' && (job.leaseUntil ?? 0) < at)
        )
        .sort((a, b) => a.runAt - b.runAt);

      for (const job of candidates.slice(0, limit)) {
        // The previous holder never came back, so its attempt is written for it — otherwise a replica that died
        // mid-run leaves a job that simply restarts, with nothing anywhere saying it had been tried.
        if (job.status === 'running') {
          appendAttempt(job, {
            status: 'lost',
            startedAt: job.updatedAt,
            endedAt: at,
            workerId: job.workerId ?? 'unknown',
            error: 'the worker holding this job stopped reporting'
          });
        }

        job.status = 'running';
        job.attempts += 1;
        job.workerId = workerId;
        job.leaseUntil = at + leaseMs;
        job.updatedAt = at;
        taken.push({ ...job });
      }

      return taken;
    },

    heartbeat: ({ jobIds, workerId, leaseMs }) => {
      const at = now();
      const stops: { jobId: string; stop: JobStop }[] = [];
      for (const id of jobIds) {
        const job = jobs.get(id);
        if (!job || job.workerId !== workerId || job.status !== 'running') {
          continue;
        }

        job.leaseUntil = at + leaseMs;
        // A cancel wins over a pause asked of the same job: set aside, it would only wait to be dropped.
        if (job.cancelRequested) {
          stops.push({ jobId: id, stop: 'cancel' });
        } else if (job.pauseRequested) {
          stops.push({ jobId: id, stop: 'pause' });
        }
      }

      return stops;
    },

    write: ({ jobId, workerId, state, progress }: JobWrite) => {
      const job = jobs.get(jobId);
      if (!job || job.workerId !== workerId || job.status !== 'running') {
        return false;
      }

      const at = now();
      if (state !== undefined) {
        job.state = state;
      }

      if (progress) {
        job.progress = { ...progress, at };
      }

      job.updatedAt = at;

      return true;
    },

    settle: ({
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
      const job = jobs.get(jobId);
      // A settlement from a worker that no longer holds the job is a report from the past: its lease lapsed, the
      // job was reclaimed, and whoever holds it now owns the outcome. Dropping it is what stops a slow replica
      // from overwriting a live attempt with a stale verdict.
      if (!job || job.workerId !== workerId) {
        return undefined;
      }

      const at = now();
      if (attempt) {
        appendAttempt(job, { ...attempt, startedAt: job.updatedAt, endedAt: at });
      }

      // Asked to stop while it was settling: the next slice it was handed back for is what that stop was about.
      job.status =
        status === 'pending' && job.cancelRequested
          ? 'cancelled'
          : status === 'pending' && job.pauseRequested
            ? 'paused'
            : status;
      job.updatedAt = at;
      job.leaseUntil = undefined;
      job.error = error;
      job.cancelRequested = undefined;
      job.pauseRequested = undefined;
      if (runId) {
        job.runId = runId;
      }

      if (result !== undefined) {
        job.result = result;
      }

      if (spentMs) {
        job.activeMs = (job.activeMs ?? 0) + spentMs;
      }

      if (refund) {
        // Handed back untouched, or a slice that did not fail: the attempt it took is given back too.
        job.attempts = Math.max(0, job.attempts - 1);
      }

      if (job.status === 'pending') {
        job.runAt = at + (delayMs ?? 0);
      }

      if (job.status === 'pending' || job.status === 'paused') {
        job.workerId = undefined;
      }

      evict();

      return undefined;
    },

    dueSchedules: limit => {
      const at = now();

      return [...schedules.values()]
        .filter(schedule => schedule.enabled && schedule.nextRunAt <= at)
        .sort((a, b) => a.nextRunAt - b.nextRunAt)
        .slice(0, limit)
        .map(schedule => ({ ...schedule }));
    },

    advanceSchedule: ({ spaceId, actionId, from, to, missed }) => {
      const schedule = schedules.get(key(spaceId, actionId));
      if (!schedule || schedule.nextRunAt !== from) {
        return false;
      }

      schedule.nextRunAt = to;
      schedule.lastFireAt = from;
      schedule.missed += missed;
      schedule.updatedAt = now();

      return true;
    },

    putSchedules: ({ spaceId, schedules: incoming }) => {
      const at = now();
      const keep = new Set(incoming.map(schedule => key(spaceId, schedule.actionId)));
      for (const existing of schedules.keys()) {
        if (existing.startsWith(`${spaceId}:`) && !keep.has(existing)) {
          schedules.delete(existing);
        }
      }

      for (const incomingSchedule of incoming) {
        const id = key(spaceId, incomingSchedule.actionId);
        const existing = schedules.get(id);
        // An existing schedule keeps its own `nextRunAt`: it is a fire already promised, and recomputing it on
        // every save would let a space saved once a minute never reach a due time at all.
        const unchanged =
          existing &&
          existing.cron === incomingSchedule.cron &&
          existing.timezone === incomingSchedule.timezone &&
          existing.environment === incomingSchedule.environment;
        schedules.set(id, {
          ...incomingSchedule,
          missed: existing?.missed ?? 0,
          ...(existing?.lastFireAt === undefined ? {} : { lastFireAt: existing.lastFireAt }),
          nextRunAt: unchanged ? existing.nextRunAt : incomingSchedule.nextRunAt,
          updatedAt: at
        });
      }

      return undefined;
    },

    listJobs: ({ spaceIds, name, status, kind, limit, offset }: JobQuery) => {
      const matching = [...jobs.values()]
        .filter(
          job =>
            spaceIds.includes(job.spaceId) &&
            (name === undefined || job.target.name === name) &&
            (status === undefined || job.status === status) &&
            (kind === undefined || job.target.kind === kind)
        )
        .sort((a, b) => b.updatedAt - a.updatedAt);

      return {
        jobs: matching.slice(offset, offset + limit).map(job => ({ ...job })),
        total: matching.length
      };
    },

    getJob: (spaceIds, jobId) => owned(spaceIds, jobId),

    listSchedules: spaceIds => [...schedules.values()].filter(schedule => spaceIds.includes(schedule.spaceId)),

    requeue: (spaceIds, jobId, { input, fresh = false } = {}) => {
      const job = owned(spaceIds, jobId);
      if (!job || !isTerminalJobStatus(job.status)) {
        return false;
      }

      job.status = 'pending';
      job.runAt = now();
      job.attempts = 0;
      job.workerId = undefined;
      job.leaseUntil = undefined;
      job.cancelRequested = undefined;
      job.pauseRequested = undefined;
      job.error = undefined;
      job.result = undefined;
      if (input) {
        job.input = input;
      }

      if (fresh) {
        job.state = undefined;
        job.progress = undefined;
        job.activeMs = undefined;
      }

      job.updatedAt = now();

      return true;
    },

    cancel: (spaceIds, jobId) => {
      const job = owned(spaceIds, jobId);
      if (!job || isTerminalJobStatus(job.status)) {
        return false;
      }

      // A waiting job is simply dropped; a running one is FLAGGED, because the only thing that can stop a flow is
      // the worker holding it, and it reads this at its next heartbeat.
      if (job.status === 'pending' || job.status === 'paused') {
        job.status = 'cancelled';
        job.workerId = undefined;
        job.pauseRequested = undefined;
      } else {
        job.cancelRequested = true;
      }

      job.updatedAt = now();

      return true;
    },

    pause: (spaceIds, jobId) => {
      const job = owned(spaceIds, jobId);
      // Only a job of the space's functions saves where it is: a flow set aside would only start again from nothing.
      if (
        job?.target.kind !== 'function' ||
        (job.status !== 'pending' && job.status !== 'running') ||
        job.pauseRequested
      ) {
        return false;
      }

      if (job.status === 'pending') {
        job.status = 'paused';
      } else {
        job.pauseRequested = true;
      }

      job.updatedAt = now();

      return true;
    },

    resume: (spaceIds, jobId) => {
      const job = owned(spaceIds, jobId);
      if (job?.status !== 'paused') {
        return false;
      }

      job.status = 'pending';
      job.runAt = now();
      job.updatedAt = now();

      return true;
    },

    cancelPending: ({ spaceId, key, olderThan }) => {
      const newest = olderThan === undefined ? undefined : jobs.get(olderThan);
      const isOlder = (job: Job): boolean =>
        newest === undefined ||
        job.createdAt < newest.createdAt ||
        (job.createdAt === newest.createdAt && job.id < newest.id);
      const at = now();
      let dropped = 0;
      for (const job of jobs.values()) {
        if (
          job.spaceId === spaceId &&
          job.key === key &&
          job.status === 'pending' &&
          job.id !== olderThan &&
          isOlder(job)
        ) {
          job.status = 'cancelled';
          job.updatedAt = at;
          dropped += 1;
        }
      }

      return dropped;
    }
  };
};

/** A state with nothing in it. */
export const emptyState = (): QueueState => ({ jobs: new Map(), schedules: new Map() });

/** How a store runs one method of the rules: reading its state, and keeping it after one that changes it. */
export type QueueAccess = <K extends keyof JobQueue>(
  method: K,
  args: Parameters<JobQueue[K]>
) => Promise<Awaited<ReturnType<JobQueue[K]>>>;

/** One method of the rules, called with the arguments its contract types. */
export const applyRule = <K extends keyof JobQueue>(
  rules: QueueRules,
  method: K,
  args: Parameters<JobQueue[K]>
): Awaited<ReturnType<JobQueue[K]>> => {
  // TypeScript cannot tie a generic key's method to that key's arguments (a correlated union): each is the same K's.
  const rule = rules[method] as (...given: Parameters<JobQueue[K]>) => Awaited<ReturnType<JobQueue[K]>>;

  return rule(...args);
};

/** The contract, each method run through `access`: what every store answers with. */
export const queueOver = (access: QueueAccess): JobQueue => ({
  now: (...args) => access('now', args),
  enqueue: (...args) => access('enqueue', args),
  claim: (...args) => access('claim', args),
  heartbeat: (...args) => access('heartbeat', args),
  settle: (...args) => access('settle', args),
  write: (...args) => access('write', args),
  dueSchedules: (...args) => access('dueSchedules', args),
  advanceSchedule: (...args) => access('advanceSchedule', args),
  putSchedules: (...args) => access('putSchedules', args),
  listJobs: (...args) => access('listJobs', args),
  getJob: (...args) => access('getJob', args),
  listSchedules: (...args) => access('listSchedules', args),
  requeue: (...args) => access('requeue', args),
  cancel: (...args) => access('cancel', args),
  pause: (...args) => access('pause', args),
  resume: (...args) => access('resume', args),
  cancelPending: (...args) => access('cancelPending', args)
});
