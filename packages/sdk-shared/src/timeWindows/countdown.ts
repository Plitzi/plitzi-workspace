import { instantOf, TIME_WINDOW_TYPE } from './timeWindows';

import type { Schema } from '../types';

/** The element that says how long is left until an instant. */
export const COUNTDOWN_TYPE = 'countdown';

/** The units a countdown says what is left in, largest first. */
export const COUNTDOWN_UNITS = ['days', 'hours', 'minutes', 'seconds'] as const;

export type CountdownUnit = (typeof COUNTDOWN_UNITS)[number];

/** How a countdown names its units: in words (`days`), short (`d`, `hr`), or not at all. */
export const COUNTDOWN_LABELS = ['long', 'short', 'none'] as const;

export type CountdownLabels = (typeof COUNTDOWN_LABELS)[number];

const UNIT_MS: Readonly<Record<CountdownUnit, number>> = {
  days: 86_400_000,
  hours: 3_600_000,
  minutes: 60_000,
  seconds: 1000
};

/** Intl's name for each unit, which it writes in the page's language and plural. */
const INTL_UNIT: Readonly<Record<CountdownUnit, string>> = {
  days: 'day',
  hours: 'hour',
  minutes: 'minute',
  seconds: 'second'
};

export type CountdownPart = { unit: CountdownUnit; amount: number };

/** The units from `largest` down to `smallest`, in order; one unit alone when they are written the other way round. */
export const countdownUnits = (largest: CountdownUnit, smallest: CountdownUnit): CountdownUnit[] => {
  const from = COUNTDOWN_UNITS.indexOf(largest);
  const to = COUNTDOWN_UNITS.indexOf(smallest);

  return COUNTDOWN_UNITS.slice(from, Math.max(from, to) + 1);
};

/**
 * What is left from `now` until `to`, in each unit from `largest` down to `smallest` — the largest holding whatever does
 * not fit below it (49 hours with `largest: 'hours'`). Counted up to the smallest unit, so the last second reads 1, not
 * 0, until it is over; every part 0 from then on.
 */
export const countdownParts = (
  now: number,
  to: number,
  largest: CountdownUnit = 'days',
  smallest: CountdownUnit = 'seconds'
): CountdownPart[] => {
  const units = countdownUnits(largest, smallest);
  const step = UNIT_MS[units[units.length - 1]];
  let left = Math.max(0, Math.ceil((to - now) / step) * step);

  return units.map(unit => {
    const amount = Math.floor(left / UNIT_MS[unit]);
    left -= amount * UNIT_MS[unit];

    return { unit, amount };
  });
};

/** The next instant after `now` what a countdown shows changes at — a second, or a minute, less — or none once over. */
export const nextCountdownTick = (now: number, to: number, smallest: CountdownUnit = 'seconds'): number | undefined => {
  const step = UNIT_MS[smallest];
  const left = to - now;
  if (left <= 0) {
    return undefined;
  }

  return to - (Math.ceil(left / step) - 1) * step;
};

/** What is left as an ISO 8601 duration — `P2DT3H4M` — what a `<time datetime>` says it in. */
export const countdownDuration = (parts: readonly CountdownPart[]): string => {
  const of = (unit: CountdownUnit) => parts.find(part => part.unit === unit)?.amount ?? 0;
  const time = [
    [of('hours'), 'H'],
    [of('minutes'), 'M'],
    [of('seconds'), 'S']
  ]
    .filter(([amount]) => amount !== 0)
    .map(([amount, letter]) => `${String(amount)}${String(letter)}`)
    .join('');
  const days = of('days') > 0 ? `${String(of('days'))}D` : '';

  return days || time ? `P${days}${time ? `T${time}` : ''}` : 'PT0S';
};

/**
 * A unit's name for an amount of it, in `locale` and its plural — `days`, `día`, `hr` — or `''` with no labels. A
 * locale the runtime does not know is read as English.
 */
export const countdownLabel = (
  unit: CountdownUnit,
  amount: number,
  labels: CountdownLabels,
  locale: string
): string => {
  if (labels === 'none') {
    return '';
  }

  for (const tag of [locale || 'en', 'en']) {
    try {
      return new Intl.NumberFormat(tag, { style: 'unit', unit: INTL_UNIT[unit], unitDisplay: labels })
        .formatToParts(amount)
        .filter(part => part.type === 'unit')
        .map(part => part.value)
        .join('')
        .trim();
    } catch {
      continue;
    }
  }

  return '';
};

/** The instant a countdown counts to: its own `to`, or the end of the time window around it. */
export const countdownTarget = (to: unknown, windowEnd: unknown): number | undefined =>
  instantOf(to) ?? (to === undefined || to === '' ? instantOf(windowEnd) : undefined);

/** The types whose pages are drawn at an instant the browser hydrates at: what shows, or says, by the time. */
const CLOCK_TYPES: ReadonlySet<string> = new Set([TIME_WINDOW_TYPE, COUNTDOWN_TYPE]);

/** Whether a space shows or says anything by the time, on its pages or in its components. */
export const readsTheClock = (schema: Pick<Schema, 'flat'> & Partial<Pick<Schema, 'components'>>): boolean =>
  [schema.flat, ...Object.values(schema.components ?? {}).map(component => component.flat)].some(flat =>
    Object.values(flat).some(element => CLOCK_TYPES.has(element.definition.type))
  );
