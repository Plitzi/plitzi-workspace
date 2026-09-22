import { cronNextFire, isKnownTimeZone } from '@plitzi/sdk-shared/actions';

import { findTriggerNode, triggerParams } from '../runtime/triggers';

import type { ActionEntry, ActionScheduleInput, Environment } from '@plitzi/sdk-shared';

/** Attempts a scheduled job is given before it is left for an operator. Overridable per deployment. */
export const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * The schedule a document declares, or nothing.
 *
 * The cron and the zone are read through the same fields the runner used to read at every tick — but read ONCE,
 * when the document is saved, and written to a row. What the tick then reads is a due time, not a JSON blob: the
 * difference between one indexed query a minute and every action document in the deployment, parsed.
 *
 * A zone `Intl` does not know is dropped rather than silently treated as UTC. The validator already tells the
 * author, and a schedule that fires at the wrong hour is worse than one that visibly never fires at all.
 */
export const scheduleFor = (
  entry: ActionEntry,
  spaceId: number,
  environment: Environment,
  from: Date,
  maxAttempts = DEFAULT_MAX_ATTEMPTS
): ActionScheduleInput | undefined => {
  const node = findTriggerNode(entry.document.nodes, 'schedule');
  if (!node) {
    return undefined;
  }

  const params = triggerParams(node);
  const cron = params.cron?.trim();
  if (!cron) {
    return undefined;
  }

  const zone = params.timezone?.trim();
  const timezone = zone && isKnownTimeZone(zone) ? zone : undefined;
  const nextRunAt = cronNextFire(cron, from, timezone);
  if (!nextRunAt) {
    return undefined;
  }

  return {
    spaceId,
    actionId: entry.id,
    cron,
    ...(timezone ? { timezone } : {}),
    environment,
    // A switched-off trigger keeps its row rather than losing it: an operator looking at the panel has to be able
    // to see that this space HAS a nightly digest and that somebody turned it off, which a missing row cannot say.
    enabled: node.enabled,
    nextRunAt: nextRunAt.getTime(),
    maxAttempts
  };
};

/** Every schedule a space's actions declare, as of one instant. */
export const schedulesFor = (
  entries: ActionEntry[],
  spaceId: number,
  environment: Environment,
  from: Date,
  maxAttempts = DEFAULT_MAX_ATTEMPTS
): ActionScheduleInput[] =>
  entries
    .map(entry => scheduleFor(entry, spaceId, environment, from, maxAttempts))
    .filter((schedule): schedule is ActionScheduleInput => schedule !== undefined);

/**
 * The id a fire gets, and the whole of the exactly-once guarantee.
 *
 * Derived from the STORED fire instant rather than from any node's reading of the clock, so two replicas that
 * disagree about what time it is still write the same id — and the second one's enqueue is a no-op.
 */
export const scheduleJobId = (spaceId: number, actionId: string, fireAt: number): string =>
  `schedule:${spaceId}:${actionId}:${fireAt}`;
