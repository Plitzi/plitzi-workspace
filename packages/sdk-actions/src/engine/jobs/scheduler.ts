import { serverLog } from '@plitzi/sdk-kernel/log';
import { cronFiresBetween, cronNextFire } from '@plitzi/sdk-shared/actions';

import { heldAtLimit } from './endings';
import { createFailureStreak } from './failureStreak';
import { DEFAULT_MAX_ATTEMPTS, scheduleJobId, schedulesFor } from './schedules';

import type { FailureStreak } from './failureStreak';
import type { JobQueue, ActionSchedule } from '../../types';
import type { ActionLookups } from '../types';
import type { ActionRunLimit, Environment } from '@plitzi/sdk-shared';

const MINUTE_MS = 60_000;

/** Where a schedule is parked when its expression has no next fire at all. Four years out, which is the horizon
 *  {@link cronNextFire} searches: nothing inside it matched, so nothing inside it will. */
const PARK_MS = 4 * 366 * 24 * 60 * MINUTE_MS;

/**
 * How long a schedule waits on a fire set aside at a limit before it tries one again by itself. What a run holds can
 * depend on the day's data, and nobody may be watching: held for ever by one large day, a feed would never come back.
 * A day apart it is one run that says where it stands — not one a minute.
 */
const HELD_RETRY_MS = 24 * 60 * MINUTE_MS;

export type SchedulerOptions = {
  queue: JobQueue;
  lookups: ActionLookups;
  /**
   * Whether a space may have scheduled runs at all — its plan, say: why not, or nothing. A space refused has none:
   * its schedules are taken off the queue, and a fire already due is not run. Absent, every space may.
   */
  admit?: (spaceId: number) => Promise<string | undefined>;
  /** Which environment scheduled runs execute in. Defaults to `main`, the document the builder edits. */
  environment?: Environment;
  /** How often this replica looks for due schedules. Default 15s — the resolution of a cron is a minute. */
  pollMs?: number;
  /** Schedules swept per pass. */
  batch?: number;
  /** Attempts a job produced here is given. */
  maxAttempts?: number;
  /** How often a space's schedules are re-derived from its documents. Default 15 minutes. A deployment that
   *  reconciles on save needs this only as a safety net. */
  reconcileMs?: number;
  /** The spaces to reconcile, for a server that serves a known few. `listScheduledSpaces` wins over it. */
  spaces?: number[];
  /** Every failed pass, in place of the default report — a warning, then an error once a pass has kept failing for a
   *  minute (see `createFailureStreak`). */
  onError?: (error: unknown) => void;
};

export type SweepResult = {
  /** Fires this pass turned into jobs. */
  enqueued: string[];
  /** Fires another replica had already enqueued. Not a problem: it is the guarantee working. */
  duplicates: string[];
  /** Fires that went by while nothing was running, by schedule. */
  missed: { spaceId: number; actionId: string; count: number }[];
  /** Fires not made into jobs: their schedule waits on the job named, set aside at a limit it would meet again. */
  held: { spaceId: number; actionId: string; jobId: string; limit: ActionRunLimit }[];
};

export type Scheduler = {
  /** One pass. Exposed because a deployment driving this from its own cron — a k8s CronJob, a queue tick — needs
   *  a way in that is not a timer, and because a test must not have to wait for one. */
  sweep: () => Promise<SweepResult>;
  /** Re-derives one space's schedules from its action documents. Called by a deployment whenever they change. */
  reconcile: (spaceId: number) => Promise<void>;
  start: () => void;
  stop: () => void;
};

/**
 * Turns due schedules into jobs. Nothing else.
 *
 * **There is no leader.** Every replica sweeps, and that is safe because a fire's job id is derived from the fire's
 * own stored instant: two replicas reaching the same fire write the same id, and the queue keeps the first. A
 * leader lock would only add a way for the cluster to have no producer at all for a minute — which is exactly the
 * failure a nightly digest cannot afford.
 *
 * **No clock is trusted but the queue's.** Which schedules are due is the queue's answer, the fire instant is the
 * one the schedule row already held, and the next one is computed from that row. A replica in Santiago and a
 * replica in Frankfurt produce the same fires, once each, however far apart their clocks have drifted.
 *
 * **A fire is enqueued BEFORE the schedule moves on.** If this process dies between the two, the schedule is still
 * due, the next sweep enqueues the same id — a no-op — and advances. Nothing is produced twice and nothing is
 * lost; the ordering is the whole of that guarantee.
 *
 * **An outage does not replay as a storm.** The overdue fire becomes one job, and the schedule then jumps to the
 * first occurrence after now, recording how many went by. A digest missed for a day sends once and says it missed
 * 23 — rather than sending 23 times, which is how a scheduler that "catches up" turns an outage into an incident.
 *
 * **A limit is not fired into again.** A fire set aside because its code went past what its plan gives it — its
 * memory, its CPU, its calls — would be at the next fire too: the schedule waits on that one job, moving on with the
 * clock, until somebody resumes or cancels it; and tries one again by itself a day later. An every-minute sweep that
 * needed more memory than its size has was one more job set aside every minute, each a failed run.
 */
export const createScheduler = ({
  queue,
  lookups,
  environment = 'main',
  pollMs = 15_000,
  batch = 200,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  reconcileMs = 15 * MINUTE_MS,
  spaces,
  admit,
  onError
}: SchedulerOptions): Scheduler => {
  /** What was last said of each space refused, so a refusal is said once, not on every sweep. */
  const refused = new Map<number, string>();
  const refusalOf = async (spaceId: number): Promise<string | undefined> => {
    const why = await admit?.(spaceId);
    if (why && refused.get(spaceId) !== why) {
      serverLog.warn('Actions', `space ${String(spaceId)} runs nothing on a schedule: ${why}`);
    }

    if (why) {
      refused.set(spaceId, why);
    } else {
      refused.delete(spaceId);
    }

    return why;
  };
  let timer: NodeJS.Timeout | undefined;
  let reconcileTimer: NodeJS.Timeout | undefined;
  let running = false;
  /** The job each schedule was last said to wait on, so it is said once — not at every fire held back. */
  const waiting = new Map<string, string>();

  const produce = async (schedule: ActionSchedule, at: Date, result: SweepResult): Promise<void> => {
    const { spaceId, actionId, cron, timezone, nextRunAt: fireAt } = schedule;
    // A space whose plan no longer runs schedules since its last reconcile: its schedules go now, this fire with them.
    if (await refusalOf(spaceId)) {
      await queue.putSchedules({ spaceId, schedules: [] });

      return;
    }

    const id = scheduleJobId(spaceId, actionId, fireAt);
    // The fire before needed a larger worker: this one starts there, rather than taking a smaller one down first.
    const before =
      schedule.lastFireAt === undefined
        ? undefined
        : await queue.getJob([spaceId], scheduleJobId(spaceId, actionId, schedule.lastFireAt));

    // The fire before was set aside at a limit its code meets again: this one would be too. The schedule waits on it
    // — and keeps its place, so nothing is owed when it goes on.
    const limit = before ? heldAtLimit(before) : undefined;
    const key = `${String(spaceId)}:${actionId}`;
    if (before && limit && at.getTime() - before.dueAt < HELD_RETRY_MS) {
      if (waiting.get(key) !== before.id) {
        waiting.set(key, before.id);
        serverLog.warn(
          'Actions',
          `schedule ${actionId} of space ${String(spaceId)} waits: its run ${before.id} was set aside at its ${limit} ` +
            'limit, which the next would reach too. It fires again once that job is resumed or cancelled, and tries ' +
            'one by itself a day after it.'
        );
      }

      result.held.push({ spaceId, actionId, jobId: before.id, limit });
      const late = Math.max(fireAt, at.getTime());
      const following = cronNextFire(cron, new Date(Math.floor(late / MINUTE_MS) * MINUTE_MS + MINUTE_MS), timezone);
      await queue.advanceSchedule({
        spaceId,
        actionId,
        from: fireAt,
        to: following ? following.getTime() : late + PARK_MS,
        missed: 0,
        held: true
      });

      return;
    }

    waiting.delete(key);
    const created = await queue.enqueue({
      id,
      spaceId,
      environment: schedule.environment,
      target: { kind: 'action', name: actionId, trigger: 'schedule' },
      input: {},
      dueAt: fireAt,
      maxAttempts: schedule.maxAttempts,
      ...(before?.needsMemoryMb === undefined ? {} : { needsMemoryMb: before.needsMemoryMb })
    });
    (created ? result.enqueued : result.duplicates).push(id);

    // Late by more than the fire itself: the occurrences in between are gone, and an operator is owed the number.
    const lateness = Math.max(fireAt, at.getTime());
    const missed = cronFiresBetween(cron, new Date(fireAt), new Date(lateness), timezone);
    /**
     * The first occurrence strictly after `lateness` — which, fires being whole minutes, is the first at or after
     * the minute following the one `lateness` falls in. Not `lateness + 1 minute`: `cronNextFire` rounds up to a
     * whole minute, so a sweep seven seconds late would ask from 00:02:07, get 00:03, and an every-minute schedule
     * would fire every other minute.
     */
    const next = cronNextFire(cron, new Date(Math.floor(lateness / MINUTE_MS) * MINUTE_MS + MINUTE_MS), timezone);

    await queue.advanceSchedule({
      spaceId,
      actionId,
      from: fireAt,
      to: next ? next.getTime() : lateness + PARK_MS,
      missed
    });

    if (missed > 0) {
      result.missed.push({ spaceId, actionId, count: missed });
    }
  };

  const sweep = async (): Promise<SweepResult> => {
    const result: SweepResult = { enqueued: [], duplicates: [], missed: [], held: [] };
    const at = await queue.now();
    for (const schedule of await queue.dueSchedules(batch)) {
      await produce(schedule, at, result);
    }

    return result;
  };

  const reconcile = async (spaceId: number): Promise<void> => {
    if (await refusalOf(spaceId)) {
      await queue.putSchedules({ spaceId, schedules: [] });

      return;
    }

    const entries = (await lookups.listActions?.(spaceId)) ?? [];
    const at = await queue.now();
    await queue.putSchedules({
      spaceId,
      schedules: schedulesFor(entries, spaceId, environment, at, maxAttempts)
    });
  };

  const scheduledSpaces = async (): Promise<number[]> =>
    lookups.listScheduledSpaces ? lookups.listScheduledSpaces() : (spaces ?? []);

  const reconcileAll = async (): Promise<void> => {
    for (const spaceId of await scheduledSpaces()) {
      await reconcile(spaceId);
    }
  };

  const sweepFailures = createFailureStreak('Actions', 'schedule sweep');
  const reconcileFailures = createFailureStreak('Actions', 'schedule reconcile');

  /** One pass at a time per replica: a sweep that outlives its interval must not have a second one land on top. */
  const guarded = async (pass: () => Promise<unknown>, failures: FailureStreak): Promise<void> => {
    if (running) {
      return;
    }

    running = true;
    try {
      await pass();
      failures.succeeded();
    } catch (error) {
      (onError ?? failures.failed)(error);
    } finally {
      running = false;
    }
  };

  return {
    sweep,
    reconcile,
    start: () => {
      if (timer) {
        return;
      }

      // Jittered so a cluster that rolled all at once does not then query the store in lockstep forever.
      timer = setInterval(() => void guarded(sweep, sweepFailures), pollMs + Math.floor(Math.random() * 1000));
      timer.unref();

      if (!lookups.listScheduledSpaces && !spaces?.length) {
        // Said out loud, once, because the alternative is a schedule that never fires and no way to tell that
        // apart from an expression that does not match — an afternoon of looking at the wrong thing.
        serverLog.warn(
          'Actions',
          'schedules are running but nothing says which spaces to watch. Name them as ' +
            '`action.jobs.spaces`, or answer `action.lookups.listScheduledSpaces`.'
        );

        return;
      }

      void guarded(reconcileAll, reconcileFailures);
      reconcileTimer = setInterval(() => void guarded(reconcileAll, reconcileFailures), reconcileMs);
      reconcileTimer.unref();
    },
    stop: () => {
      clearInterval(timer);
      clearInterval(reconcileTimer);
      timer = undefined;
      reconcileTimer = undefined;
    }
  };
};
