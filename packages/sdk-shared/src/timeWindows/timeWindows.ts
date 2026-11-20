import type { Schema } from '../types';

/** The element that shows what it holds only between two instants. */
export const TIME_WINDOW_TYPE = 'timeWindow';

/** An instant as an element writes one: ISO 8601 with its offset — `2026-12-01T09:00:00Z` — never a local time. */
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * The instant a window's bound names, in ms since the epoch — or `undefined` for one left empty or written without its
 * offset: a time with no zone is a different instant for every visitor, so it is never read as one.
 */
export const instantOf = (value: unknown): number | undefined => {
  if (typeof value !== 'string' || !INSTANT.test(value)) {
    return undefined;
  }

  const at = Date.parse(value);

  return Number.isNaN(at) ? undefined : at;
};

/** Whether a bound is written as an instant the window can read: empty (no bound) or ISO 8601 with its offset. */
export const isWindowBound = (value: unknown): boolean =>
  value === undefined || value === '' || instantOf(value) !== undefined;

/** Whether a window is open at `now`: from its start (none, always started) up to its end (none, never ended). */
export const isWindowOpen = (now: number, from: unknown, until: unknown): boolean => {
  const start = instantOf(from);
  const end = instantOf(until);

  return (start === undefined || now >= start) && (end === undefined || now < end);
};

/** The next instant after `now` a window opens or closes at — what a page waits for to show or hide it — or none. */
export const nextWindowChange = (now: number, from: unknown, until: unknown): number | undefined =>
  [instantOf(from), instantOf(until)]
    .filter((at): at is number => at !== undefined && at > now)
    .sort((a, b) => a - b)[0];

/** Whether a space has a time window, on its pages or in its components: its pages are drawn at an instant. */
export const hasTimeWindows = (schema: Pick<Schema, 'flat'> & Partial<Pick<Schema, 'components'>>): boolean =>
  [schema.flat, ...Object.values(schema.components ?? {}).map(component => component.flat)].some(flat =>
    Object.values(flat).some(element => element.definition.type === TIME_WINDOW_TYPE)
  );
