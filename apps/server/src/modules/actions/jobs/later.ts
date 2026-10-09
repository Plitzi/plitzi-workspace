import { randomUUID } from 'node:crypto';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { findTriggerNode } from '../runtime/triggers';

import type { ActionLookups } from '../types';
import type { ActionJobQueue, Environment, SpaceRevision } from '@plitzi/sdk-shared';

/** A month: past it, a run set for later is a schedule, and a cron says it better. */
export const MAX_LATER_SECONDS = 30 * 24 * 60 * 60;

/** A name a run set for later is known by, as a topic is written: what it is replaced and cancelled by. */
const KEY = /^[A-Za-z0-9:_.-]{1,128}$/;

/** What a run asks to start later: one of the space's actions, in so many seconds, with its input — and a name. */
export type LaterRequest = {
  /** The action, by its identifier. It says it may be started this way with a `later` trigger. */
  action: string;
  /** Seconds from now, by the queue's clock — whole or not, from 0 to a month. */
  in: number;
  input?: Record<string, unknown>;
  /**
   * What it is known by in this space: setting another under the same key replaces the one still waiting — a turn's
   * timer moved on by a move — and `cancelLater(key)` drops it. The one already running is left be.
   */
  key?: string;
};

/** The job it became, and when it is due — epoch ms, by the queue's clock. */
export type LaterAnswer = { id: string; at: number };

export type LaterDeps = {
  /** Read when asked: the queue is made after the runner, and a server may run none. */
  queue: () => ActionJobQueue | undefined;
  lookups: Pick<ActionLookups, 'getAction'>;
  maxAttempts: number;
};

export type LaterScope = { spaceId: number; environment: Environment; at?: SpaceRevision };

/**
 * Runs of a space's actions that start in a while — a turn that runs out, a bot's move, a hold that lapses — held by the
 * same queue as its schedules: they outlive a restart where the queue does, run once across replicas, retry, and show
 * in the queue an operator reads. Every refusal says why, before anything is queued.
 */
export const laterFor = ({ queue, lookups, maxAttempts }: LaterDeps, { spaceId, environment, at }: LaterScope) => {
  const queueOrThrow = (): ActionJobQueue => {
    const found = queue();
    if (!found) {
      throw new Error(
        'This server runs no jobs — its actions have no queue (`jobs: false`, or no way to list actions)'
      );
    }

    return found;
  };

  const keyOrThrow = (key: unknown): string => {
    if (typeof key !== 'string' || !KEY.test(key)) {
      throw new Error('A key is 1 to 128 letters, digits and `:_.-` — `turn:ABCD`');
    }

    return key;
  };

  return {
    later: async ({ action, in: seconds, input = {}, key }: LaterRequest): Promise<LaterAnswer> => {
      const jobs = queueOrThrow();
      if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0 || seconds > MAX_LATER_SECONDS) {
        throw new Error(
          `"in" is a number of seconds from 0 to ${String(MAX_LATER_SECONDS)}: ${JSON.stringify(seconds)}`
        );
      }

      if (!isRecord(input)) {
        throw new Error('A run set for later is handed an object as its input');
      }

      const named = key === undefined ? undefined : keyOrThrow(key);
      const entry =
        typeof action === 'string' && action !== '' ? await lookups.getAction(spaceId, action, at) : undefined;
      if (!entry) {
        throw new Error(`Action "${action}" is not one of this space's`);
      }

      const trigger = findTriggerNode(entry.document.nodes, 'later');
      if (!trigger) {
        throw new Error(
          `Action "${action}" cannot be set to run later: give it a "later" trigger, which says it may be started this way`
        );
      }

      if (!trigger.enabled) {
        throw new Error(`Action "${action}" has its "later" trigger switched off: nothing set for later would run`);
      }

      const dueAt = (await jobs.now()).getTime() + Math.round(seconds * 1000);
      const id = `later:${String(spaceId)}:${randomUUID()}`;
      await jobs.enqueue({
        id,
        spaceId,
        actionId: entry.id,
        environment,
        trigger: 'later',
        input,
        dueAt,
        maxAttempts,
        ...(named === undefined ? {} : { key: named })
      });
      // After it is queued, and only what came before it: of two set at once, the newer is left on every replica.
      if (named !== undefined) {
        await jobs.cancelPending({ spaceId, key: named, olderThan: id });
      }

      return { id, at: dueAt };
    },

    /** Drops what is waiting under `key`, and answers how many. */
    cancelLater: (key: string): Promise<number> => queueOrThrow().cancelPending({ spaceId, key: keyOrThrow(key) })
  };
};
