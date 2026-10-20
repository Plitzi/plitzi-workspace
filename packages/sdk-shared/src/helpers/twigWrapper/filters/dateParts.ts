type DateParts = {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  weekday: number;
};

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const zoneFormatters = new Map<string, Intl.DateTimeFormat | null>();

/** One formatter per zone for the life of the process: building one is far dearer than using it. `null` = no such zone. */
const zoneFormatter = (timeZone: string): Intl.DateTimeFormat | null => {
  if (!zoneFormatters.has(timeZone)) {
    try {
      zoneFormatters.set(
        timeZone,
        new Intl.DateTimeFormat('en-US', {
          timeZone,
          hourCycle: 'h23',
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          second: 'numeric',
          weekday: 'short'
        })
      );
    } catch {
      zoneFormatters.set(timeZone, null);
    }
  }

  return zoneFormatters.get(timeZone) ?? null;
};

/**
 * An epoch as a Date: in milliseconds, as the APIs here answer — or in seconds, as Twig's own `date` and a Unix
 * timestamp are: below 10^11 a number is seconds, which in milliseconds would be a moment before March 1973.
 */
const fromEpoch = (epoch: number): Date => new Date(Math.abs(epoch) < 1e11 ? epoch * 1000 : epoch);

/**
 * What a `date` filter was handed, as a Date.
 *
 * An epoch in milliseconds is the shape every API here answers with (`nextRunAt`, `dueAt`), and it reaches a template
 * as a number or — through an attribute — as a string of digits. `new Date("1790143200000")` is Invalid Date, so
 * both are read as numbers first (`fromEpoch`, seconds too); anything else is left to the Date parser, ISO strings.
 */
export const toDate = (value: unknown): Date => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'number') {
    return fromEpoch(value);
  }

  const text = String(value).trim();
  // Twig's: `'now'|date('F Y')` is the moment the page is rendered — on the server, then again in the browser, so a
  // format finer than the minute can differ between the two.
  if (text === 'now') {
    return new Date();
  }

  return /^-?\d+$/.test(text) ? fromEpoch(Number(text)) : new Date(text);
};

/**
 * The calendar and clock parts of an instant, read in `timeZone` — or, with none, in the zone the code runs in.
 *
 * The zone is what a SERVER flow needs: its process runs in whatever zone the host was given, and "is it already
 * past 21:00 at the restaurant" is a question about the restaurant's clock. `undefined` for a zone that does not exist.
 */
export const dateParts = (date: Date, timeZone: string): DateParts | undefined => {
  if (!timeZone) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hours: date.getHours(),
      minutes: date.getMinutes(),
      seconds: date.getSeconds(),
      weekday: date.getDay()
    };
  }

  const formatter = zoneFormatter(timeZone);
  if (!formatter) {
    return undefined;
  }

  const parts = formatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find(entry => entry.type === type)?.value ?? '';

  return {
    year: Number(part('year')),
    month: Number(part('month')),
    day: Number(part('day')),
    hours: Number(part('hour')),
    minutes: Number(part('minute')),
    seconds: Number(part('second')),
    weekday: WEEKDAYS_SHORT.indexOf(part('weekday'))
  };
};
