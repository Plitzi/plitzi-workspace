import type {
  ActionJob,
  ActionJobAttempt,
  ActionJobInput,
  ActionJobQuery,
  ActionJobQueue,
  ActionJobSettlement,
  ActionSchedule
} from '@plitzi/sdk-shared';

export type MemoryJobQueueOptions = {
  /**
   * How many finished jobs to keep before the oldest are dropped.
   *
   * A bound rather than a retention period, because this store has no eviction of its own and an unbounded history
   * in a long-lived process is a leak with a nice name. A deployment that wants jobs it can still read next week
   * supplies a queue backed by something that survives a restart.
   */
  retainFinished?: number;
  /**
   * What this queue calls now, in epoch ms.
   *
   * The seam that makes a lease, a backoff and an overdue schedule testable without waiting for one — and the
   * shape of the rule a shared store keeps too: everything here reads ONE clock, and it is the store's.
   */
  clock?: () => number;
};

const TERMINAL = new Set(['succeeded', 'failed', 'dead', 'cancelled']);

/**
 * The default queue: one process's Maps.
 *
 * Correct for a deployment that runs ONE replica, which is most self-hosted ones, and honest about the rest — a
 * second replica running on this gets its own schedules and its own jobs, so a nightly digest goes out twice. The
 * cure is any store the replicas share, behind the same {@link ActionJobQueue} seam.
 *
 * It keeps the contract exactly, rather than approximately: enqueue is idempotent by id, a claim reaps lapsed
 * leases, and every instant is read here rather than accepted from a caller. A test that passes against this one
 * is testing the rules a shared store has to keep too.
 */
export const createMemoryJobQueue = ({
  retainFinished = 500,
  clock = Date.now
}: MemoryJobQueueOptions = {}): ActionJobQueue => {
  const jobs = new Map<string, ActionJob>();
  const schedules = new Map<string, ActionSchedule>();

  const key = (spaceId: number, actionId: string) => `${spaceId}:${actionId}`;
  const now = () => clock();

  /** Oldest finished jobs first, so the bound drops history rather than anything anybody is waiting on. */
  const evict = () => {
    const finished = [...jobs.values()]
      .filter(job => TERMINAL.has(job.status))
      .sort((a, b) => a.updatedAt - b.updatedAt);
    for (const job of finished.slice(0, finished.length - retainFinished)) {
      jobs.delete(job.id);
    }
  };

  const owned = (spaceIds: number[], jobId: string): ActionJob | undefined => {
    const job = jobs.get(jobId);

    return job && spaceIds.includes(job.spaceId) ? job : undefined;
  };

  /** Numbered by the history itself, not by `attempts`: an operator who repeats a finished job starts its attempt
   *  count again, and the record of what has already been tried must not start again with it. */
  const appendAttempt = (job: ActionJob, attempt: Omit<ActionJobAttempt, 'attempt'>) => {
    job.history = [...job.history, { ...attempt, attempt: job.history.length + 1 }];
  };

  return {
    now: () => Promise.resolve(new Date(now())),

    enqueue: (job: ActionJobInput) => {
      if (jobs.has(job.id)) {
        return Promise.resolve(false);
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

      return Promise.resolve(true);
    },

    claim: ({ workerId, leaseMs, limit }) => {
      const at = now();
      const taken: ActionJob[] = [];
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

      return Promise.resolve(taken);
    },

    heartbeat: ({ jobIds, workerId, leaseMs }) => {
      const at = now();
      const cancelled: string[] = [];
      for (const id of jobIds) {
        const job = jobs.get(id);
        if (!job || job.workerId !== workerId || job.status !== 'running') {
          continue;
        }

        job.leaseUntil = at + leaseMs;
        if (job.cancelRequested) {
          cancelled.push(id);
        }
      }

      return Promise.resolve(cancelled);
    },

    settle: ({ jobId, workerId, status, delayMs, runId, error, attempt }: ActionJobSettlement) => {
      const job = jobs.get(jobId);
      // A settlement from a worker that no longer holds the job is a report from the past: its lease lapsed, the
      // job was reclaimed, and whoever holds it now owns the outcome. Dropping it is what stops a slow replica
      // from overwriting a live attempt with a stale verdict.
      if (!job || job.workerId !== workerId) {
        return Promise.resolve();
      }

      const at = now();
      if (attempt) {
        appendAttempt(job, { ...attempt, startedAt: job.updatedAt, endedAt: at });
      }

      job.status = status;
      job.updatedAt = at;
      job.leaseUntil = undefined;
      job.error = error;
      if (runId) {
        job.runId = runId;
      }

      if (status === 'pending') {
        job.runAt = at + (delayMs ?? 0);
        job.workerId = undefined;
        if (!attempt) {
          // Handed back untouched: the worker never got to run it, so the attempt it took is given back too.
          job.attempts = Math.max(0, job.attempts - 1);
        }
      }

      evict();

      return Promise.resolve();
    },

    dueSchedules: limit => {
      const at = now();

      return Promise.resolve(
        [...schedules.values()]
          .filter(schedule => schedule.enabled && schedule.nextRunAt <= at)
          .sort((a, b) => a.nextRunAt - b.nextRunAt)
          .slice(0, limit)
          .map(schedule => ({ ...schedule }))
      );
    },

    advanceSchedule: ({ spaceId, actionId, from, to, missed }) => {
      const schedule = schedules.get(key(spaceId, actionId));
      if (!schedule || schedule.nextRunAt !== from) {
        return Promise.resolve(false);
      }

      schedule.nextRunAt = to;
      schedule.lastFireAt = from;
      schedule.missed += missed;
      schedule.updatedAt = now();

      return Promise.resolve(true);
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

      return Promise.resolve();
    },

    listJobs: ({ spaceIds, actionId, status, limit, offset }: ActionJobQuery) => {
      const matching = [...jobs.values()]
        .filter(
          job =>
            spaceIds.includes(job.spaceId) &&
            (actionId === undefined || job.actionId === actionId) &&
            (status === undefined || job.status === status)
        )
        .sort((a, b) => b.updatedAt - a.updatedAt);

      return Promise.resolve({
        jobs: matching.slice(offset, offset + limit).map(job => ({ ...job })),
        total: matching.length
      });
    },

    getJob: (spaceIds, jobId) => Promise.resolve(owned(spaceIds, jobId)),

    listSchedules: spaceIds =>
      Promise.resolve([...schedules.values()].filter(schedule => spaceIds.includes(schedule.spaceId))),

    requeue: (spaceIds, jobId) => {
      const job = owned(spaceIds, jobId);
      if (!job || !TERMINAL.has(job.status)) {
        return Promise.resolve(false);
      }

      job.status = 'pending';
      job.runAt = now();
      job.attempts = 0;
      job.workerId = undefined;
      job.leaseUntil = undefined;
      job.cancelRequested = false;
      job.error = undefined;
      job.updatedAt = now();

      return Promise.resolve(true);
    },

    cancel: (spaceIds, jobId) => {
      const job = owned(spaceIds, jobId);
      if (!job || TERMINAL.has(job.status)) {
        return Promise.resolve(false);
      }

      // A waiting job is simply dropped; a running one is FLAGGED, because the only thing that can stop a flow is
      // the worker holding it, and it reads this at its next heartbeat.
      if (job.status === 'pending') {
        job.status = 'cancelled';
        job.workerId = undefined;
      } else {
        job.cancelRequested = true;
      }

      job.updatedAt = now();

      return Promise.resolve(true);
    }
  };
};
