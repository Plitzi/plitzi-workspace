import { randomUUID } from 'node:crypto';

import { serverLog } from '@plitzi/sdk-kernel/log';
import { overloaded, processLoad } from '@plitzi/sdk-kernel/stats';

import { KEPT_CALL_MS } from './calls';
import { onlyFull, withoutFull } from './claimSpaces';
import { createFailureStreak } from './failureStreak';
import { NEAR_MEMORY_SHARE, memoryWords, nearMemory, readProcessMemory } from './memoryWatch';
import { ActionRunError } from '../runtime/errors';

import type { MemoryReading } from './memoryWatch';
import type { FunctionJobsService } from '../../functions/jobs';
import type { JobClaimMemory, JobQueue, JobSettlement, JobSpaces, JobWake } from '../../types';
import type { ActionsModule } from '../module';
import type { ActionLookups, ActionRunResult } from '../types';
import type { ProcessLoad } from '@plitzi/sdk-kernel/stats';
import type { Job } from '@plitzi/sdk-shared';

/**
 * Refusals that mean "not now" rather than "not ever".
 *
 * Both are the cluster protecting itself — another run holds the single-flight key, or this replica is already
 * carrying as much as it will — and neither says anything about the job. So the job goes back to the queue with
 * its attempt REFUNDED: burning one would let a busy afternoon retire a nightly digest as dead.
 */
const TRY_AGAIN = new Set(['duplicate', 'over_capacity']);

/**
 * Why a job was handed back "not now", in the words its line in the queue says — again in a second or two. Short and
 * plain: it is read beside every waiting job of a burst; which ceiling (`concurrency.perSpace`, the worker's own) is the
 * docs' to say, not every line's.
 */
const NOT_NOW_WORDS: Partial<Record<string, string>> = {
  over_capacity: 'Waiting for a free slot',
  duplicate: 'Waiting for the same run to finish'
};

/**
 * How long from `now` — the queue's clock, which every instant of it is read by — until the next minute begins, and a
 * moment more: when a budget over the minute may be spent again.
 */
const msToNextMinute = (now: number): number => 60_000 - (now % 60_000) + Math.floor(Math.random() * 5_000);

/**
 * How soon a job refused "not now" comes round again: a slot of its space frees in seconds, not the half minute and more
 * a failure's backoff waits — a burst's jobs refused at their space's ceiling each waited 30–60 s for nothing.
 */
const tryAgainMs = (): number => 1_000 + Math.floor(Math.random() * 1_000);

/**
 * What a job is reckoned to hold until this worker has measured its own (what it holds over what it held idle, by the
 * jobs it runs): a flow waiting on somebody else's API holds a few MiB.
 */
const JOB_MEMORY_FLOOR_MB = 8;

/** The share of its memory a worker helps others with while idle (`helps`): the rest is kept for what only it may run. */
const HELP_MEMORY_SHARE = 0.5;

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Why a run that ended badly did, in the words an operator can act on: the step that failed and what it said.
 *
 * Read from `steps` — the outline, whose errors are already redacted of every credential the run resolved — so
 * nothing lands on the job that the run history would not show. A run that failed without any step failing (a
 * timeout between steps, a budget spent) has no step to name, and says how it ended instead.
 */
const failureOf = (result: ActionRunResult): string => {
  const failed = result.steps.find(step => step.phase === 'flow' && step.status === 'failed');

  return failed
    ? `step "${failed.id}" failed: ${failed.error ?? 'no reason given'}`
    : `the flow ended ${result.status}`;
};

/**
 * Refusals no number of attempts will change: the action was deleted, its schedule was switched off, or the
 * document refuses this trigger. Retrying is noise, and the job stops where an operator can see why.
 */
const GIVE_UP = new Set(['not_found', 'disabled', 'forbidden', 'recursion']);

/**
 * The limits the same code meets again on every attempt — what it spends of CPU, memory, calls, output, steps or
 * requests: a job stopped at one is set aside at once, for its owner to fix or its plan to allow more, rather than run
 * twice more for nothing. Time is not among them: an API slow for a minute answers the next attempt.
 */
const SET_ASIDE_LIMITS = new Set(['cpu', 'memory', 'calls', 'output', 'steps', 'requests', 'response']);

/** Why a job stopped at one of {@link SET_ASIDE_LIMITS} waits for somebody. */
export const limitSetAsideError = (said: string): string =>
  `Set aside at once: it reached a limit its plan sets, which it would reach again on every attempt. Fix it, or give ` +
  `its plan more, then resume it. It said: ${said}`;

/**
 * Why a job that failed every attempt waits: it is set aside (`paused`) for somebody to read its runs and decide —
 * resume it once fixed, with every attempt again, or cancel it.
 */
export const failedOutError = (attempts: number, last: string): string =>
  `Set aside after ${String(attempts)} failed attempt${attempts === 1 ? '' : 's'}: look at its runs, then resume it ` +
  `once fixed — every attempt again — or cancel it. The last said: ${last}`;

export type JobWorkerOptions = {
  queue: JobQueue;
  lookups: ActionLookups;
  module: ActionsModule;
  /** What runs a job of a space's functions (`function` on the job), slice by slice. Absent, such a job waits. */
  functionJobs?: FunctionJobsService;
  /**
   * How many jobs this replica runs AT ONCE.
   *
   * The number that decides whether five hundred queued jobs take five minutes or an hour, and it is a deployment's
   * to set because only it knows what its jobs do: flows that wait on somebody else's API are cheap to hold many of,
   * flows that render or transform are not. Zero makes this replica a producer only — which is how a deployment
   * dedicates a pod to running jobs and leaves the ones serving pages alone. With `memory`, it is the most: near its
   * memory the replica takes no new job, whatever slots it has, and takes no more at once than its memory has room for.
   * Near all of its CPU it takes none either. A slot is taken again as soon as its job ends.
   *
   * It does not widen the run guards. A replica whose `concurrency.perSpace` is 10 will hold 10 runs for one space
   * however many workers it has, and the rest go back to the queue and come round again.
   */
  workers?: number;
  /** How often a worker with a free slot looks for work. Default 1s. */
  pollMs?: number;
  /** Told a job is due now (`JobWake.listen`): it looks at once, rather than on its next look. */
  wake?: JobWake;
  /**
   * Which spaces' jobs this replica takes, asked on every claim: a worker kept for some spaces takes theirs alone, the
   * others every space but those. Absent, every space's.
   */
  spaces?: () => JobSpaces | undefined;
  /**
   * What this replica may hold and the most any of the deployment's may, asked on every claim (`JobClaimMemory`): a job
   * a worker died running is then left to one that may hold more, or set aside when none may. Absent, as it always was.
   */
  memory?: () => JobClaimMemory | undefined;
  /**
   * Whose jobs this replica takes besides its own while it has more than one slot free, asked on every claim: a larger
   * worker kept for the heavy jobs helps the others while it is idle, and keeps a slot for what only it may run.
   * Absent, its own alone.
   */
  helps?: () => JobSpaces | undefined;
  /**
   * How often, while it holds jobs, this replica reads how near its memory it is (with `memory`): near it, it marks
   * them (`heartbeat`'s `nearMemoryLimit`), so that should it die, they run next on a larger worker. Default 1s.
   */
  memoryWatchMs?: number;
  /** This process's memory, as the watch reads it. Default `process.memoryUsage.rss()` and V8's heap. */
  readMemory?: () => MemoryReading;
  /** This process's CPU and event loop, as a claim reads them: past `LOAD_LIMITS` it takes nothing. Default `processLoad`. */
  readLoad?: () => ProcessLoad;
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
  /** Every failure, in place of the default report. By default a claim or a heartbeat that fails is a warning, and an
   *  error once it has kept failing for a minute (see `createFailureStreak`); anything else is an error at once. */
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
  /** Reads how near its memory this replica is, and marks the jobs it holds when near — `start` does it every second. */
  watchMemory: () => Promise<void>;
  start: () => void;
  /**
   * Stops claiming, then waits for every job this worker is running to FINISH — however long past its lease that is.
   *
   * The heartbeat keeps renewing their claims meanwhile, so no other replica takes a job over while this one is still
   * running it, and an operator's cancel still reaches it. Each wait is bounded by the run's own timeout, which is
   * the number an orchestrator's grace period has to cover: a pod killed before that loses the run to a lease that
   * lapses, and another replica runs it again.
   */
  stop: () => Promise<void>;
  inFlight: () => number;
};

export const createJobWorker = ({
  queue,
  lookups,
  module,
  functionJobs,
  workers = 4,
  pollMs = 1_000,
  wake,
  spaces,
  memory,
  helps,
  memoryWatchMs = 1_000,
  readMemory = readProcessMemory,
  readLoad = processLoad,
  leaseMs = 30_000,
  backoff = {},
  workerId = `${process.pid}-${randomUUID().slice(0, 8)}`,
  onError: customOnError
}: JobWorkerOptions): JobWorker => {
  const onError = customOnError ?? ((error: unknown) => serverLog.error('Actions', 'job worker failed', error));
  const claimFailures = createFailureStreak('Actions', 'job claim');
  const heartbeatFailures = createFailureStreak('Actions', 'job heartbeat');
  const { baseMs = 30_000, maxMs = 15 * 60_000 } = backoff;
  const active = new Map<string, AbortController>();
  /** Of `active`, the jobs of a space's functions: what a stop asks to save and hand back, rather than waits for. */
  const slicing = new Set<string>();
  /** Of `active`, the jobs taken in a spare slot, past their space's share (`room().spare`): their runs say so. */
  const spareJobs = new Set<string>();
  /** Every job this worker started, until it has settled — what `stop()` waits for. */
  const inFlight = new Set<Promise<void>>();
  let timer: NodeJS.Timeout | undefined;
  let heart: NodeJS.Timeout | undefined;
  let stopListening: (() => void) | undefined;
  /** A pass asked for while one was under way: run once that one ends. Read through a call: another sets it meanwhile. */
  let again = false;
  const askedAgain = (): boolean => again;
  /** Why it is holding back new jobs — its memory, its CPU — so it says so once a reason, not every poll. */
  let holdingBack: string | undefined;
  /** What it held the last time it ran nothing: what a job holds is read over it. */
  let idleRssMb: number | undefined;
  let watch: NodeJS.Timeout | undefined;
  let stopping = false;
  let pass: Promise<void> | undefined;
  // Read through a call where it is read after an await: `stop()` can set it meanwhile, and the compiler keeps the
  // value it narrowed before the await.
  const isStopping = (): boolean => stopping;

  /** Doubles per attempt, with a jitter so a batch that failed together does not retry together. */
  const retryDelay = (attempts: number): number => {
    const step = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempts - 1));

    return step + Math.floor(Math.random() * Math.min(step, 30_000));
  };

  const settle = async (settlement: JobSettlement): Promise<void> => {
    try {
      await queue.settle(settlement);
    } catch (error) {
      // The lease is what covers this: a settlement that never lands leaves the job held until it lapses, and the
      // next worker takes it over. Losing the report is survivable; losing the job is not.
      onError(error);
    }
  };

  /** Back to the queue with nothing held against it — see {@link TRY_AGAIN}. */
  const release = (job: Job, delayMs: number, error: string) =>
    settle({ jobId: job.id, workerId, status: 'pending', delayMs, error });

  const fail = (
    job: Job,
    runId: string | undefined,
    error: string,
    { spentMs, refused = false }: { spentMs?: number; refused?: boolean } = {}
  ) => {
    const exhausted = job.attempts >= job.maxAttempts;
    if (exhausted) {
      serverLog.warn(
        'Actions',
        `job ${job.id} of space ${String(job.spaceId)} set aside after ${String(job.attempts)} failed attempt(s), for ` +
          `someone to look at its runs: ${error}`
      );
    }

    // Out of attempts it waits for somebody, not for nothing: whatever failed may be fixed, and only a person knows.
    return settle({
      jobId: job.id,
      workerId,
      status: exhausted ? 'paused' : 'pending',
      ...(exhausted ? {} : { delayMs: retryDelay(job.attempts) }),
      ...(runId ? { runId } : {}),
      ...(spentMs ? { spentMs } : {}),
      error: exhausted ? failedOutError(job.attempts, error) : error,
      attempt: { status: 'failed', workerId, ...(runId ? { runId } : {}), error, ...(refused ? { refused } : {}) }
    });
  };

  /**
   * One slice of a job of a space's functions, settled by how it ended: done, set aside, cancelled, handed back to go on
   * in the next slice — or failed, to be tried again from what it saved.
   */
  const executeSlice = async (job: Job, jobs: FunctionJobsService): Promise<void> => {
    const controller = new AbortController();
    active.set(job.id, controller);
    slicing.add(job.id);
    try {
      await jobs.announce(job.spaceId, job.id);
      const outcome = await jobs.slice(job, controller.signal, workerId);
      const base = { jobId: job.id, workerId };
      switch (outcome.kind) {
        case 'wait':
          await release(job, outcome.delayMs, outcome.why);
          break;
        case 'done':
          await settle({
            ...base,
            status: 'succeeded',
            result: outcome.result,
            spentMs: outcome.spentMs,
            attempt: { status: 'succeeded', workerId }
          });
          break;
        case 'failed':
          if (outcome.final) {
            await settle({
              ...base,
              status: 'failed',
              spentMs: outcome.spentMs,
              error: outcome.error,
              attempt: {
                status: 'failed',
                workerId,
                error: outcome.error,
                ...(outcome.refused ? { refused: true as const } : {})
              }
            });
          } else {
            await fail(job, undefined, outcome.error, { spentMs: outcome.spentMs });
          }

          break;
        case 'stopped':
          if (outcome.stop === 'pause') {
            await settle({
              ...base,
              status: 'paused',
              refund: true,
              spentMs: outcome.spentMs,
              attempt: { status: 'paused', workerId }
            });
          } else if (outcome.stop === 'cancel') {
            await settle({
              ...base,
              status: 'cancelled',
              spentMs: outcome.spentMs,
              attempt: { status: 'cancelled', workerId }
            });
          } else if (outcome.stop === 'shutdown' || outcome.saved) {
            // Its time in one go up, or the replica going: the next slice goes on from what it saved, at once.
            await settle({ ...base, status: 'pending', delayMs: 0, refund: true, spentMs: outcome.spentMs });
          } else {
            await fail(
              job,
              undefined,
              'its slice ran out of time without saving progress — job.save where it is, to go on in the next one',
              { spentMs: outcome.spentMs }
            );
          }

          break;
      }
    } catch (error) {
      await fail(job, undefined, messageOf(error));
    } finally {
      active.delete(job.id);
      slicing.delete(job.id);
      await jobs.announce(job.spaceId, job.id);
    }
  };

  const execute = async (job: Job): Promise<void> => {
    const { target } = job;
    if (target.kind === 'function') {
      if (functionJobs) {
        await executeSlice(job, functionJobs);
      } else {
        await release(job, retryDelay(1), 'Waiting for a worker that runs functions’ jobs');
      }

      return;
    }

    const { name: actionId, trigger } = target;
    // A visitor's call kept until something could run it: run as theirs, under the key they named it by.
    const call = trigger === 'call' && target.callerId ? { ...target, callerId: target.callerId } : undefined;
    // Its `dueAt` is when it was kept, by the clock of the process that kept it — the clock this one reads.
    if (call && Date.now() - job.dueAt > KEPT_CALL_MS) {
      await settle({
        jobId: job.id,
        workerId,
        status: 'dead',
        error: 'kept a day and nothing could run it: not run so long after it was asked',
        attempt: { status: 'failed', workerId, error: 'expired' }
      });

      return;
    }

    const entry = await lookups.getAction(job.spaceId, actionId, call?.at);
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

    // Its code has no runner to run on now: not started, the attempt refunded, so nothing of it runs half-way — a
    // schedule's fire and a kept call alike wait for one.
    if (await module.codeAway(job.spaceId, entry.document, call?.at)) {
      await release(job, retryDelay(1), 'Waiting for a functions runner to answer');

      return;
    }

    const ttlMs = (await module.limitsFor(job.spaceId, entry.document)).timeoutMs;
    const begin = call?.idempotencyKey
      ? // The key its caller named: a call that ran after all — the page's first try reached a worker — answers with
        // that run, and one running now is not started twice.
        {
          spaceId: job.spaceId,
          actionId,
          callerId: call.callerId,
          input: job.input,
          idempotencyKey: call.idempotencyKey,
          ttlMs,
          ...(spareJobs.has(job.id) ? { spare: true } : {})
        }
      : {
          spaceId: job.spaceId,
          actionId,
          callerId: call?.callerId ?? trigger,
          input: job.input,
          // The JOB is the unit of work, so the job's own id is its single-flight key. That is what stops a worker
          // that merely stalled — lease lapsed, job handed to somebody else — from running the same flow twice
          // alongside its replacement: the second one is refused as a duplicate and comes back later.
          idempotencyKey: job.id,
          ...(spareJobs.has(job.id) ? { spare: true } : {}),
          sharedKey: true,
          ttlMs
        };
    if (call) {
      const replayed = await module.guards.replay(begin);
      if (replayed) {
        await settle({
          jobId: job.id,
          workerId,
          status: 'succeeded',
          runId: replayed.runId,
          result: { ...replayed },
          attempt: { status: 'succeeded', workerId, runId: replayed.runId }
        });

        return;
      }
    }

    let run;
    try {
      run = await module.guards.begin(begin);
    } catch (error) {
      const refusal = error instanceof ActionRunError ? error.reason : undefined;
      /**
       * Two different things, and telling them apart is what decides whether the job survives.
       *
       * A REFUSAL is the cluster answering: another run holds the key, this replica is full. A throw that is not a
       * refusal means the guards could not be consulted at all — the shared store is unreachable — and that is
       * infrastructure rather than anything about this job. Both go back with the attempt REFUNDED.
       *
       * Counting an outage as attempts is how a queue loses work: with three attempts and a widening backoff, a
       * Redis blip of two minutes retires every scheduled job in the cluster as `dead`, permanently, and the digest
       * nobody got is indistinguishable from one nobody asked for. The job comes back instead, carrying why, and an
       * operator sees a queue that is waiting rather than a queue that has been emptied.
       */
      if (!refusal || TRY_AGAIN.has(refusal)) {
        await release(job, tryAgainMs(), NOT_NOW_WORDS[refusal ?? ''] ?? `Waiting: ${messageOf(error)}`);

        return;
      }

      await fail(job, undefined, `could not start: ${refusal}`);

      return;
    }

    active.set(job.id, run.controller);
    try {
      const result = await module.runAction({
        entry,
        input: job.input,
        spaceId: job.spaceId,
        environment: job.environment,
        trigger,
        callerId: call?.callerId ?? trigger,
        ...(call?.user ? { user: call.user } : {}),
        ...(call?.origin ? { origin: call.origin } : {}),
        ...(call?.at ? { at: call.at } : {}),
        runId: run.runId,
        signal: run.controller.signal
      });
      // What its caller reads once it ran (`readKeptCall`): the answer the page would have had then.
      const answer = call
        ? {
            result: {
              runId: result.runId,
              status: result.status === 'completed' ? 'completed' : 'failed',
              output: result.output,
              ...(result.error === undefined ? {} : { error: result.error }),
              ...(result.code === undefined ? {} : { code: result.code })
            }
          }
        : {};

      if (result.status === 'completed') {
        await settle({
          jobId: job.id,
          workerId,
          status: 'succeeded',
          runId: run.runId,
          ...answer,
          attempt: { status: 'succeeded', workerId, runId: run.runId }
        });

        return;
      }

      // A call that ran and failed answered its caller: a refusal, a step's error — said once, never run again.
      if (call && !(result.status === 'aborted' && run.controller.signal.aborted)) {
        await settle({
          jobId: job.id,
          workerId,
          status: 'failed',
          runId: run.runId,
          error: failureOf(result),
          ...answer,
          attempt: { status: 'failed', workerId, runId: run.runId, error: failureOf(result) }
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

      // Its account's CPU for the minute, spent: not now rather than wrong — back next minute, its attempt refunded.
      if (result.limit === 'cpuBudget') {
        await release(job, msToNextMinute((await queue.now()).getTime()), failureOf(result));

        return;
      }

      if (result.limit && SET_ASIDE_LIMITS.has(result.limit)) {
        const said = failureOf(result);
        serverLog.warn(
          'Actions',
          `job ${job.id} of space ${String(job.spaceId)} set aside at its plan's limit: ${said}`
        );
        await settle({
          jobId: job.id,
          workerId,
          status: 'paused',
          runId: run.runId,
          error: limitSetAsideError(said),
          attempt: { status: 'failed', workerId, runId: run.runId, error: said }
        });

        return;
      }

      await fail(job, run.runId, failureOf(result));
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

      await fail(job, run.runId, messageOf(error));
    } finally {
      active.delete(job.id);
      await module.guards.end(run);
    }
  };

  /**
   * How many more jobs its memory has room for, under `share` of what it may hold — and of what V8 lets its heap grow
   * to: what it holds over what it held idle, shared by the jobs it runs, is what one more is reckoned to hold.
   */
  const roomFor = (reading: MemoryReading, limitMb: number, share: number): number => {
    if (active.size === 0) {
      idleRssMb = reading.rssMb;
    }

    const perJobMb =
      active.size === 0
        ? JOB_MEMORY_FLOOR_MB
        : Math.max(JOB_MEMORY_FLOOR_MB, (reading.rssMb - (idleRssMb ?? reading.rssMb)) / active.size);
    const roomMb = Math.min(limitMb * share - reading.rssMb, reading.heapLimitMb * share - reading.heapUsedMb);

    return Math.max(0, Math.floor(roomMb / perJobMb));
  };

  /** Holds back new jobs for `reason`, saying so once a reason; nothing, to say it takes them again. */
  const holdBack = (reason: string | undefined): void => {
    if (reason && reason !== holdingBack) {
      serverLog.warn('Actions', `job worker ${workerId}: ${reason} — takes no new job until it is not`);
    }

    holdingBack = reason;
  };

  /** Whether a job is one a worker died running, which may need all this one has. */
  const needing = (job: Job): boolean => job.needsMemoryMb !== undefined;
  /** The ids of the jobs it runs that a worker died running: one at a time. */
  const runningNeeding = new Set<string>();

  const poll = async (): Promise<number> => {
    const free = workers - active.size;
    if (stopping || free <= 0) {
      return 0;
    }

    const room = module.guards.room();
    const asked = withoutFull(spaces?.(), room.fullSpaces);
    const limits = memory?.();
    const reading = limits ? readMemory() : undefined;
    // Near its memory or its CPU it takes no new job, whatever slots it has: what it holds finishes first.
    const busy =
      (limits && reading && nearMemory(reading, limits.mb)
        ? `near its memory (${memoryWords(reading, limits.mb)})`
        : undefined) ??
      overloaded(readLoad()) ??
      (room.calls === 0 ? 'carries as many calls as it takes at once (`concurrency.perProcess`)' : undefined);
    holdBack(busy);
    if (busy) {
      return 0;
    }

    const memoryRoom = limits && reading ? roomFor(reading, limits.mb, NEAR_MEMORY_SHARE) : free;
    const holds = limits ? { ...limits, takesNeeding: runningNeeding.size === 0 } : undefined;
    const asking = Math.max(1, Math.min(free, memoryRoom, room.calls));
    const claimed = await queue.claim({
      workerId,
      leaseMs,
      limit: asking,
      ...(asked ? { spaces: asked } : {}),
      ...(holds ? { memory: holds } : {})
    });
    // Its own work first; idle past one slot, it takes others' with half its memory — the rest, and a slot, kept for
    // what only it may run.
    const helpRoom = limits && reading ? roomFor(reading, limits.mb, HELP_MEMORY_SHARE) - claimed.length : free;
    const spare = Math.min(free - claimed.length - 1, helpRoom, room.calls - claimed.length);
    const helping = spare > 0 ? withoutFull(helps?.(), room.fullSpaces) : undefined;
    if (helping) {
      claimed.push(
        ...(await queue.claim({
          workerId,
          leaseMs,
          limit: spare,
          spaces: helping,
          ...(holds ? { memory: holds } : {})
        }))
      );
    }
    // Every space's share taken and slots left with nothing else due: more of the spaces at their share, past it — a
    // share kept free (`room().spare`) for the next space's work. A space's burst no longer waits behind its own share
    // while the worker idles: under a load probe, its 20 ms actions waited 37 s behind its own runs that waited for a
    // runner.
    const leftover = Math.min(free - claimed.length, room.spare, memoryRoom - claimed.length);
    const sparing = claimed.length < asking && leftover > 0 ? onlyFull(spaces?.(), room.fullSpaces) : undefined;
    if (sparing) {
      const taken = await queue.claim({
        workerId,
        leaseMs,
        limit: leftover,
        spaces: sparing,
        ...(holds ? { memory: holds } : {})
      });
      taken.forEach(job => spareJobs.add(job.id));
      claimed.push(...taken);
    }

    if (isStopping()) {
      // Claimed while this replica was being told to stop: handed straight back, attempt refunded, for a replica
      // that is staying to take now — rather than started here and held up the shutdown.
      await Promise.all(claimed.map(job => release(job, 0, 'Waiting: this worker is shutting down')));

      return 0;
    }

    // One a worker died running at a time: what else this claim took of them goes back, for another worker or later.
    const extra = claimed.filter(needing).slice(runningNeeding.size === 0 ? 1 : 0);
    await Promise.all(extra.map(job => release(job, 0, 'Waiting: this worker already runs one that needs its memory')));
    const started = claimed.filter(job => !extra.includes(job));

    for (const job of started) {
      if (job.needsMemoryMb !== undefined) {
        runningNeeding.add(job.id);
        serverLog.warn(
          'Actions',
          `job ${job.id} of space ${String(job.spaceId)}: a worker died running it — running it here, which may hold ` +
            `${String(holds?.mb ?? '?')} MiB (it needs more than ${String(job.needsMemoryMb - 1)})`
        );
      }

      // Deliberately not awaited: the point of `workers` is that this pass starts several and returns.
      const running = execute(job).catch(onError);
      inFlight.add(running);
      // Its slot is taken again at once, not at the next poll: a queue of short jobs runs as fast as they end.
      void running.finally(() => {
        inFlight.delete(running);
        runningNeeding.delete(job.id);
        spareJobs.delete(job.id);
        if (timer && !stopping) {
          void guarded();
        }
      });
    }

    return started.length;
  };

  /** Renews every claim this worker holds, and stops the ones an operator asked to cancel. */
  const beat = async (): Promise<void> => {
    const held = [...active.keys()];
    if (held.length === 0) {
      return;
    }

    // Why it is stopped goes with the abort: a job's slice saves and is set aside on a pause, ends on a cancel.
    for (const { jobId, stop } of await queue.heartbeat({ jobIds: held, workerId, leaseMs })) {
      active.get(jobId)?.abort(stop);
    }
  };

  /** The jobs this replica marked as held near its memory: each is said once, while it holds it. */
  const markedNear = new Set<string>();

  /**
   * Reads how near its memory this replica is, and near it, marks the jobs it holds — at once, not at the next beat: a
   * worker this near may not live to it. Each job is said once in the log, with what was read.
   */
  const watchMemory = async (): Promise<void> => {
    const limitMb = memory?.()?.mb;
    for (const jobId of markedNear) {
      if (!active.has(jobId)) {
        markedNear.delete(jobId);
      }
    }

    if (limitMb === undefined || active.size === 0) {
      return;
    }

    const reading = readMemory();
    const unmarked = [...active.keys()].filter(jobId => !markedNear.has(jobId));
    if (!nearMemory(reading, limitMb) || unmarked.length === 0) {
      return;
    }

    unmarked.forEach(jobId => markedNear.add(jobId));
    serverLog.warn(
      'Actions',
      `near its memory (${memoryWords(reading, limitMb)}) while running ${unmarked.join(', ')}: should this worker ` +
        'die, they run next on a larger one'
    );
    await queue.heartbeat({ jobIds: [...active.keys()], workerId, leaseMs, nearMemoryLimit: true });
  };

  /** One pass at a time, and the one under way is kept so `stop()` can wait for the claim it may be making. */
  const guarded = async (): Promise<void> => {
    // Asked again while a pass is under way — a job ended mid-claim — it runs once more after, not a second at once.
    if (pass) {
      again = true;

      return;
    }

    do {
      again = false;
      pass = poll()
        .then(() => claimFailures.succeeded())
        .catch(customOnError ?? claimFailures.failed)
        .finally(() => {
          pass = undefined;
        });
      await pass;
    } while (askedAgain() && timer && !stopping);
  };

  return {
    poll,
    beat,
    watchMemory,
    inFlight: () => active.size,
    start: () => {
      if (timer || workers <= 0) {
        return;
      }

      timer = setInterval(() => void guarded(), pollMs);
      timer.unref();
      stopListening = wake?.listen(() => void guarded());
      heart = setInterval(
        () =>
          void beat()
            .then(() => heartbeatFailures.succeeded())
            .catch(customOnError ?? heartbeatFailures.failed),
        Math.max(1_000, Math.floor(leaseMs / 3))
      );
      heart.unref();
      if (memory) {
        watch = setInterval(() => void watchMemory().catch(onError), memoryWatchMs);
        watch.unref();
      }
    },
    stop: async () => {
      stopping = true;
      clearInterval(timer);
      timer = undefined;
      stopListening?.();
      stopListening = undefined;

      // A claim already on its way comes back to a worker that is stopping, and hands its jobs back — see `poll`.
      await pass;

      if (inFlight.size > 0) {
        serverLog.info('Actions', `waiting for ${inFlight.size} running job(s) to finish before stopping`);
      }

      // A job's slice may have hours to go: it is asked to save and hand back, and another replica goes on from there.
      for (const jobId of slicing) {
        active.get(jobId)?.abort('shutdown');
      }

      /**
       * Drained rather than abandoned: a deploy finishes the jobs it started instead of leaving them to be retried.
       *
       * The heartbeat is stopped only AFTER, and that is the half that makes waiting safe. A job longer than its
       * lease used to lose its claim the moment the drain began — another replica took it over and ran it again
       * while this one was still finishing it, and the drain gave up at the lease regardless.
       */
      await Promise.allSettled([...inFlight]);
      clearInterval(heart);
      heart = undefined;
      clearInterval(watch);
      watch = undefined;
    }
  };
};
