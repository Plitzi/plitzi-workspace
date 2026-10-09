import { ActionRefusal } from './errors';

import type { ActionKvStore } from '../types';

/** How much of something is allowed: `most` in every `perSeconds`, for each caller or for everyone together. */
export type RateLimit = {
  most: number;
  perSeconds: number;
  per?: 'caller' | 'everyone';
  /**
   * Over the limit, the call is refused with these words — the step's error, on the page — rather than answered
   * `allowed: false` for the code to check: `ctx.rateLimit('make', { most: 5, perSeconds: 600, refuse: 'Wait ten minutes' })`.
   */
  refuse?: string;
};

/** Where a limit stands after counting one more: whether that one was within it, and how many are left. */
export type RateCount = { allowed: boolean; count: number; remaining: number };

/**
 * Counts one more of `bucket` in the current window and says whether it was within the limit — the one count behind
 * the `flow.rateLimit` step and a function's `ctx.rateLimit`, so a flow and code limiting the same bucket count
 * together. Refusing is the caller's: a step refuses the run, a function decides what to answer.
 */
export const countRate = async (
  kv: ActionKvStore,
  callerId: string,
  bucket: string,
  { most, perSeconds, per = 'caller' }: RateLimit
): Promise<RateCount> => {
  if (!bucket || !Number.isInteger(most) || most < 1 || !Number.isInteger(perSeconds) || perSeconds < 1) {
    throw new Error('A rate limit names what it counts, and allows a whole number of runs over whole seconds');
  }

  const window = Math.floor(Date.now() / (perSeconds * 1000));
  const who = per === 'everyone' ? 'everyone' : callerId;
  // The window's own key, living a little past it so a counter is never read after it has started over.
  const count = await kv.increment(`$rate:${bucket}:${who}:${String(window)}`, 1, perSeconds + 1);

  return { allowed: count <= most, count, remaining: Math.max(0, most - count) };
};

/** A count past its limit, refused with the limit's own words when it says some; within it, or with none, as counted. */
export const refusedOver = (count: RateCount, limit: RateLimit): RateCount => {
  if (!count.allowed && limit.refuse) {
    throw new ActionRefusal(limit.refuse);
  }

  return count;
};
