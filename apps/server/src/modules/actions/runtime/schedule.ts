import { cronMatches } from '@plitzi/sdk-shared/actions';

import { ActionRunError } from './errors';
import { findTriggerNode, triggerParams } from './triggers';

import type { ActionsModule } from '../index';
import type { ActionLookups } from '../types';
import type { Environment } from '@plitzi/sdk-shared';

export type ScheduleTick = {
  spaceId: number;
  environment?: Environment;
  /** The minute being asked about. Passed in rather than read here so a tick is testable and a missed one can be
   *  replayed deliberately — never guessed at. */
  at?: Date;
};

export type ScheduleResult = {
  ran: { actionId: string; runId: string; status: string }[];
  skipped: { actionId: string; reason: string }[];
};

export type ScheduleRunner = { tick: (params: ScheduleTick) => Promise<ScheduleResult> };

/**
 * Runs the actions a space has scheduled for this minute.
 *
 * It owns no timer, on purpose. What ticks it is the deployment's: a leader-locked interval in one role, a k8s
 * CronJob hitting an endpoint, a queue consumer — all of which have to answer "which replica" and "what happens
 * on restart", and none of which the SDK can answer for a deployment it cannot see.
 *
 * Missed ticks are NOT replayed. A scheduler that catches up fires an hour of digests at once after an outage,
 * which is worse than the digest nobody got; the caller that wants a replay asks for that minute explicitly.
 */
export const createScheduleRunner = (lookups: ActionLookups, module: ActionsModule): ScheduleRunner => {
  const tick = async ({ spaceId, environment = 'main', at = new Date() }: ScheduleTick): Promise<ScheduleResult> => {
    const result: ScheduleResult = { ran: [], skipped: [] };
    // The live documents, for the same reason a webhook reads live: a schedule is the space's, not a page's, and
    // a cron pinned to an old revision would keep running a flow its author already replaced.
    const entries = (await lookups.listActions?.(spaceId)) ?? [];

    for (const entry of entries) {
      // The step that declares the schedule. No step, no clock: an action reachable only from a page is never
      // swept, which is what makes this loop cheap over a space with many actions.
      const schedule = findTriggerNode(entry.document.nodes, 'schedule');
      const params = schedule ? triggerParams(schedule) : undefined;
      const cron = params?.cron;
      if (!schedule?.enabled || !cron) {
        continue;
      }

      // The zone the author wrote the expression IN. `0 9 * * 1-5` under `America/Santiago` means nine in the
      // morning there, in January and in July alike — the offset is not a constant and neither is the instant.
      // Absent, it is UTC, which is what the builder's field says.
      if (!cronMatches(cron, at, typeof params.timezone === 'string' ? params.timezone : undefined)) {
        continue;
      }

      let run;
      try {
        // The single-flight key is the minute itself, so two replicas racing the same tick — or a leader lock that
        // handed over mid-minute — start one run between them rather than one each.
        run = await module.guards.begin({
          spaceId,
          actionId: entry.id,
          callerId: 'schedule',
          input: {},
          idempotencyKey: `schedule:${at.toISOString().slice(0, 16)}`,
          // A minute belongs to the cluster, not to a caller: the point of the key is that two replicas reaching
          // the same tick run it once between them.
          sharedKey: true,
          ttlMs: module.limitsFor(entry.document).timeoutMs
        });
      } catch (error) {
        result.skipped.push({
          actionId: entry.id,
          reason: error instanceof ActionRunError ? error.reason : 'failed'
        });
        continue;
      }

      try {
        const run_ = await module.runAction({
          entry,
          input: {},
          spaceId,
          environment,
          trigger: 'schedule',
          callerId: 'schedule',
          runId: run.runId,
          signal: run.controller.signal
        });
        result.ran.push({ actionId: entry.id, runId: run_.runId, status: run_.status });
      } catch (error) {
        result.skipped.push({
          actionId: entry.id,
          reason: error instanceof ActionRunError ? error.reason : 'failed'
        });
      } finally {
        await module.guards.end(run);
      }
    }

    return result;
  };

  return { tick };
};
