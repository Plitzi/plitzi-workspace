import { randomUUID } from 'node:crypto';

import { ActionRunError } from '../runtime/errors';

import type { ActionsModule } from '../index';
import type { ActionLookups } from '../types';
import type { ActionJob, ActionJobQueue, ActionJobSettlement } from '@plitzi/sdk-shared';

/**
 * Refusals that mean "not now" rather than "not ever".
 *
 * Both are the cluster protecting itself — another run holds the single-flight key, or this replica is already
 * carrying as much as it will — and neither says anything about the job. So the job goes back to the queue with
 * its attempt REFUNDED: burning one would let a busy afternoon retire a nightly digest as dead.
 */
const TRY_AGAIN = new Set(['duplicate', 'over_capacity']);

/**
 * Refusals no number of attempts will change: the action was deleted, its schedule was switched off, or the
 * document refuses this trigger. Retrying is noise, and the job stops where an operator can see why.
 */
const GIVE_UP = new Set(['not_found', 'disabled', 'forbidden', 'recursion']);

export type JobWorkerOptions = {
  queue: ActionJobQueue;
  lookups: ActionLookups;
  module: ActionsModule;
  /**
   * How many jobs this replica runs AT ONCE.
   *
   * The number that decides whether five hundred queued jobs take five minutes or an hour, and it is a deployment's
   * to set because only it knows what its jobs do: flows that wait on somebody else's API are cheap to hold many of,
   * flows that render or transform are not. Zero makes this replica a producer only — which is how a deployment
   * dedicates a pod to running jobs and leaves the ones serving pages alone.
   *
   * It does not widen the run guards. A replica whose `concurrency.perSpace` is 10 will hold 10 runs for one space
   * however many workers it has, and the rest go back to the queue and come round again.
   */
  workers?: number;
  /** How often a worker with a free slot looks for work. Default 1s. */
  pollMs?: number;
  /**
   * How long a claim is held before another worker may take the job over.
   *
   * The failover window, in other words: a replica that is killed has its jobs picked up this long afterwards. It
   * is renewed every third of its length while a job runs, so a long flow keeps its claim and a dead process does
   * not. Shorter is a faster recovery and a higher chance of taking a job away from a worker that was merely
   * stalled; the single-flight key is what makes that safe rather than doubled.
   */
  leaseMs?: number;
  /** First retry delay, doubling per attempt, and the ceiling it doubles up to. */
  backoff?: { baseMs?: number; maxMs?: number };
  /** Names this replica in the job history, so a bad one is identifiable. Defaults to the process and a random id. */
  workerId?: string;
  onError?: (error: unknown) => void;
};

export type JobWorker = {
  /** One pass: claim what fits in the free slots and start it. Exposed for a deployment that drives its own loop. */
  poll: () => Promise<number>;
  /**
   * Renews every claim this worker holds, and aborts the ones an operator asked to cancel.
   *
   * Exposed beside `poll` for the same reason: a deployment driving its own loop owns both halves, and a worker
   * that polls without beating loses its jobs to the next replica halfway through them.
   */
  beat: () => Promise<void>;
  start: () => void;
  /** Stops claiming, then waits for what is in flight. A job still running when the process goes is not lost —
   *  its lease lapses and another replica takes it. */
  stop: () => Promise<void>;
  inFlight: () => number;
};

export const createJobWorker = ({
  queue,
  lookups,
  module,
  workers = 4,
  pollMs = 1_000,
  leaseMs = 30_000,
  backoff = {},
  workerId = `${process.pid}-${randomUUID().slice(0, 8)}`,
  onError = error => console.error('[Actions] job worker failed:', error)
}: JobWorkerOptions): JobWorker => {
  const { baseMs = 30_000, maxMs = 15 * 60_000 } = backoff;
  const active = new Map<string, AbortController>();
  let timer: NodeJS.Timeout | undefined;
  let heart: NodeJS.Timeout | undefined;
  let stopping = false;
  let polling = false;

  /** Doubles per attempt, with a jitter so a batch that failed together does not retry together. */
  const retryDelay = (attempts: number): number => {
    const step = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempts - 1));

    return step + Math.floor(Math.random() * Math.min(step, 30_000));
  };

  const settle = async (settlement: ActionJobSettlement): Promise<void> => {
    try {
      await queue.settle(settlement);
    } catch (error) {
      // The lease is what covers this: a settlement that never lands leaves the job held until it lapses, and the
      // next worker takes it over. Losing the report is survivable; losing the job is not.
      onError(error);
    }
  };

  /** Back to the queue with nothing held against it — see {@link TRY_AGAIN}. */
  const release = (job: ActionJob, delayMs: number, error: string) =>
    settle({ jobId: job.id, workerId, status: 'pending', delayMs, error });

  const fail = (job: ActionJob, runId: string | undefined, error: string) => {
    const exhausted = job.attempts >= job.maxAttempts;

    return settle({
      jobId: job.id,
      workerId,
      status: exhausted ? 'dead' : 'pending',
      ...(exhausted ? {} : { delayMs: retryDelay(job.attempts) }),
      ...(runId ? { runId } : {}),
      error,
      attempt: { status: 'failed', workerId, ...(runId ? { runId } : {}), error }
    });
  };

  const execute = async (job: ActionJob): Promise<void> => {
    const entry = await lookups.getAction(job.spaceId, job.actionId);
    if (!entry) {
      await settle({
        jobId: job.id,
        workerId,
        status: 'dead',
        error: 'the action this job belongs to no longer exists',
        attempt: { status: 'failed', workerId, error: 'action not found' }
      });

      return;
    }

    let run;
    try {
      run = await module.guards.begin({
        spaceId: job.spaceId,
        actionId: job.actionId,
        callerId: 'schedule',
        input: job.input,
        // The JOB is the unit of work, so the job's own id is its single-flight key. That is what stops a worker
        // that merely stalled — lease lapsed, job handed to somebody else — from running the same flow twice
        // alongside its replacement: the second one is refused as a duplicate and comes back later.
        idempotencyKey: job.id,
        sharedKey: true,
        ttlMs: module.limitsFor(entry.document).timeoutMs
      });
    } catch (error) {
      const refusal = error instanceof ActionRunError ? error.reason : undefined;
      if (refusal && TRY_AGAIN.has(refusal)) {
        await release(job, retryDelay(1), `not started: ${refusal}`);

        return;
      }

      // The MESSAGE when the guards threw something that is not a refusal, because that is a store being
      // unreachable or a misconfiguration — and "could not start: failed" is a sentence nobody can act on.
      await fail(
        job,
        undefined,
        `could not start: ${refusal ?? (error instanceof Error ? error.message : String(error))}`
      );

      return;
    }

    active.set(job.id, run.controller);
    try {
      const result = await module.runAction({
        entry,
        input: job.input,
        spaceId: job.spaceId,
        environment: job.environment,
        trigger: job.trigger,
        callerId: 'schedule',
        runId: run.runId,
        signal: run.controller.signal
      });

      if (result.status === 'completed') {
        await settle({
          jobId: job.id,
          workerId,
          status: 'succeeded',
          runId: run.runId,
          attempt: { status: 'succeeded', workerId, runId: run.runId }
        });

        return;
      }

      // An abort here is an operator's cancel, and it is not a failure to retry: somebody asked for it to stop.
      if (result.status === 'aborted' && run.controller.signal.aborted) {
        await settle({
          jobId: job.id,
          workerId,
          status: 'cancelled',
          runId: run.runId,
          attempt: { status: 'cancelled', workerId, runId: run.runId }
        });

        return;
      }

      await fail(job, run.runId, `the flow ended ${result.status}`);
    } catch (error) {
      const reason = error instanceof ActionRunError ? error.reason : undefined;
      if (reason && GIVE_UP.has(reason)) {
        await settle({
          jobId: job.id,
          workerId,
          status: 'dead',
          runId: run.runId,
          error: reason,
          attempt: { status: 'failed', workerId, runId: run.runId, error: reason }
        });

        return;
      }

      await fail(job, run.runId, error instanceof Error ? error.message : String(error));
    } finally {
      active.delete(job.id);
      await module.guards.end(run);
    }
  };

  const poll = async (): Promise<number> => {
    const free = workers - active.size;
    if (stopping || free <= 0) {
      return 0;
    }

    const claimed = await queue.claim({ workerId, leaseMs, limit: free });
    for (const job of claimed) {
      // Deliberately not awaited: the point of `workers` is that this pass starts several and returns.
      void execute(job).catch(onError);
    }

    return claimed.length;
  };

  /** Renews every claim this worker holds, and stops the ones an operator asked to cancel. */
  const beat = async (): Promise<void> => {
    const held = [...active.keys()];
    if (held.length === 0) {
      return;
    }

    for (const jobId of await queue.heartbeat({ jobIds: held, workerId, leaseMs })) {
      active.get(jobId)?.abort();
    }
  };

  const guarded = async (pass: () => Promise<unknown>): Promise<void> => {
    if (polling) {
      return;
    }

    polling = true;
    try {
      await pass();
    } catch (error) {
      onError(error);
    } finally {
      polling = false;
    }
  };

  return {
    poll,
    beat,
    inFlight: () => active.size,
    start: () => {
      if (timer || workers <= 0) {
        return;
      }

      timer = setInterval(() => void guarded(poll), pollMs);
      timer.unref();
      heart = setInterval(() => void beat().catch(onError), Math.max(1_000, Math.floor(leaseMs / 3)));
      heart.unref();
    },
    stop: async () => {
      stopping = true;
      clearInterval(timer);
      clearInterval(heart);
      timer = undefined;
      heart = undefined;

      // Drained rather than abandoned, so a rolling deploy finishes the jobs it started instead of leaving them to
      // time out and be retried. Bounded by the lease: past that another replica owns them anyway.
      const deadline = Date.now() + leaseMs;
      while (active.size > 0 && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  };
};
