/**
 * Repeating a flow every so often — an autoplay, a clock, a poll of something on the page — with no plugin to write.
 *
 * The element listening, the interactions manager and authoring read this one module, so the trigger's name, its
 * floor and what it carries cannot drift between them.
 */

/** The trigger a repeating flow starts on: fired once per tick of each interval its element's flows declare. */
export const INTERVAL_TRIGGER = 'onInterval';

/** Below a quarter of a second, a flow that repeats is a busy loop that happens to wait. */
export const MIN_INTERVAL_MS = 250;

export type IntervalTriggerPayload = {
  /** The interval that ticked, in milliseconds: the flows that run are the ones declared with it. */
  interval: number;
  /** How many times it has ticked since the element appeared — `{{ tick.count }}` with `named('tick', …)`. */
  count: number;
};

/** An interval a flow declares, read as the trigger reads it: a whole number of milliseconds, at least the floor. */
export const intervalOf = (value: unknown): number | undefined => {
  const ms = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;

  return typeof ms === 'number' && Number.isInteger(ms) && ms >= MIN_INTERVAL_MS ? ms : undefined;
};
