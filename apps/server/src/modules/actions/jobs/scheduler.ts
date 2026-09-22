import { cronFiresBetween, cronNextFire } from '@plitzi/sdk-shared/actions';

import { DEFAULT_MAX_ATTEMPTS, scheduleJobId, schedulesFor } from './schedules';

import type { ActionLookups } from '../types';
import type { ActionJobQueue, ActionSchedule, Environment } from '@plitzi/sdk-shared';

const MINUTE_MS = 60_000;

/** Where a schedule is parked when its expression has no next fire at all. Four years out, which is the horizon
 *  {@link cronNextFire} searches: nothing inside it matched, so nothing inside it will. */
const PARK_MS = 4 * 366 * 24 * 60 * MINUTE_MS;

export type SchedulerOptions = {
  queue: ActionJobQueue;
  lookups: ActionLookups;
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
  onError?: (error: unknown) => void;
};

export type SweepResult = {
  /** Fires this pass turned into jobs. */
  enqueued: string[];
  /** Fires another replica had already enqueued. Not a problem: it is the guarantee working. */
  duplicates: string[];
  /** Fires that went by while nothing was running, by schedule. */
  missed: { spaceId: number; actionId: string; count: number }[];
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
  onError = error => console.error('[Actions] schedule sweep failed:', error)
}: SchedulerOptions): Scheduler => {
  let timer: NodeJS.Timeout | undefined;
  let reconcileTimer: NodeJS.Timeout | undefined;
  let running = false;

  const produce = async (schedule: ActionSchedule, at: Date, result: SweepResult): Promise<void> => {
    const { spaceId, actionId, cron, timezone, nextRunAt: fireAt } = schedule;
    const id = scheduleJobId(spaceId, actionId, fireAt);

    const created = await queue.enqueue({
      id,
      spaceId,
      actionId,
      environment: schedule.environment,
      trigger: 'schedule',
      input: {},
      dueAt: fireAt,
      maxAttempts: schedule.maxAttempts
    });
    (created ? result.enqueued : result.duplicates).push(id);

    // Late by more than the fire itself: the occurrences in between are gone, and an operator is owed the number.
    const lateness = Math.max(fireAt, at.getTime());
    const missed = cronFiresBetween(cron, new Date(fireAt), new Date(lateness), timezone);
    const next = cronNextFire(cron, new Date(lateness + MINUTE_MS), timezone);

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
    const result: SweepResult = { enqueued: [], duplicates: [], missed: [] };
    const at = await queue.now();
    for (const schedule of await queue.dueSchedules(batch)) {
      await produce(schedule, at, result);
    }

    return result;
  };

  const reconcile = async (spaceId: number): Promise<void> => {
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

  /** One pass at a time per replica: a sweep that outlives its interval must not have a second one land on top. */
  const guarded = async (pass: () => Promise<unknown>): Promise<void> => {
    if (running) {
      return;
    }

    running = true;
    try {
      await pass();
    } catch (error) {
      onError(error);
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
      timer = setInterval(() => void guarded(sweep), pollMs + Math.floor(Math.random() * 1000));
      timer.unref();

      if (!lookups.listScheduledSpaces && !spaces?.length) {
        // Said out loud, once, because the alternative is a schedule that never fires and no way to tell that
        // apart from an expression that does not match — an afternoon of looking at the wrong thing.
        console.warn(
          '[Actions] schedules are running but nothing says which spaces to watch. Name them as ' +
            '`action.jobs.spaces`, or answer `action.lookups.listScheduledSpaces`.'
        );

        return;
      }

      void guarded(reconcileAll);
      reconcileTimer = setInterval(() => void guarded(reconcileAll), reconcileMs);
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
