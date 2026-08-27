/**
 * Cron matching, to the minute.
 *
 * Five fields — minute, hour, day of month, month, day of week — with `*`, lists, ranges and steps. That is the
 * vocabulary people actually write in a scheduling field, and the parts left out (`@daily`, seconds, `L`/`W`)
 * are the parts whose absence is obvious rather than subtly wrong.
 *
 * Nothing here keeps time: a caller says which minute it is asking about, which is what makes a schedule testable
 * without waiting for one.
 *
 * It lives in the shared package because two places have to agree about it and they are in different repos: the
 * runner that decides whether a schedule fires, and the validator that tells an author their expression will never
 * fire at all. Two parsers would let a document validate and then sit silent forever.
 */
const FIELD_RANGES: [number, number][] = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 6]
];

const parseField = (field: string, [min, max]: [number, number]): Set<number> | undefined => {
  const values = new Set<number>();
  for (const part of field.split(',')) {
    // `split` is typed as always-present at every index, which it is not: `"*"` has no step and `"5"` has no
    // range end. Read through a nullable view rather than trusting the lie.
    const [spec, stepText] = part.split('/') as (string | undefined)[];
    const step = stepText === undefined ? 1 : Number.parseInt(stepText, 10);
    if (!Number.isFinite(step) || step < 1) {
      return undefined;
    }

    let from = min;
    let to = max;
    if (spec !== undefined && spec !== '*' && spec !== '') {
      const [fromText, toText] = spec.split('-') as (string | undefined)[];
      from = Number.parseInt(fromText ?? '', 10);
      to = toText === undefined ? from : Number.parseInt(toText, 10);
      if (!Number.isFinite(from) || !Number.isFinite(to) || from < min || to > max || from > to) {
        return undefined;
      }
    }

    for (let value = from; value <= to; value += step) {
      values.add(value);
    }
  }

  return values;
};

export type CronExpression = Set<number>[];

/** Parses an expression, or undefined when it is not one this understands — which the validator reports rather
 *  than letting a silently-never-firing schedule sit in a document. */
export const parseCron = (expression: string): CronExpression | undefined => {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) {
    return undefined;
  }

  const parsed = fields.map((field, index) => parseField(field, FIELD_RANGES[index]));

  return parsed.every((set): set is Set<number> => set !== undefined) ? parsed : undefined;
};

/** The five numbers a cron expression is matched against — a wall clock, in whatever zone it was read in. */
type WallClock = { minute: number; hour: number; day: number; month: number; weekday: number };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const utcClock = (at: Date): WallClock => ({
  minute: at.getUTCMinutes(),
  hour: at.getUTCHours(),
  day: at.getUTCDate(),
  month: at.getUTCMonth() + 1,
  weekday: at.getUTCDay()
});

/**
 * The same instant, as the clock on a wall in `timeZone` reads it.
 *
 * Through `Intl` rather than an offset table, because an offset is not a constant: "9am in Santiago" is a
 * different instant in January and in July, and a schedule that means the working day has to follow the change.
 * `hourCycle: 'h23'` matters — the other cycles render midnight as 24, which cron has no hour for.
 *
 * An unknown zone answers `undefined` rather than falling back to UTC. Falling back is what this whole change is
 * about: a schedule that fires at the wrong hour and says nothing.
 */
export const zonedClock = (at: Date, timeZone: string): WallClock | undefined => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short'
    }).formatToParts(at);

    const value = (type: string) => parts.find(part => part.type === type)?.value ?? '';
    const weekday = WEEKDAYS.indexOf(value('weekday'));
    const clock = {
      minute: Number(value('minute')),
      hour: Number(value('hour')),
      day: Number(value('day')),
      month: Number(value('month')),
      weekday
    };

    return weekday >= 0 && Object.values(clock).every(Number.isFinite) ? clock : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Whether an expression fires at this minute — in `timeZone` when one is named, in UTC when none is.
 *
 * Day-of-month and day-of-week are OR'd when both are restricted, which is the rule every cron implementation
 * follows and the one that surprises people who expect AND — `0 0 1 * 1` fires on the first of the month AND on
 * every Monday.
 */
export const cronMatches = (expression: string, at: Date, timeZone?: string): boolean => {
  const parsed = parseCron(expression);
  if (!parsed) {
    return false;
  }

  const clock = timeZone ? zonedClock(at, timeZone) : utcClock(at);
  if (!clock) {
    return false;
  }

  const [minutes, hours, days, months, weekdays] = parsed;
  if (!minutes.has(clock.minute) || !hours.has(clock.hour) || !months.has(clock.month)) {
    return false;
  }

  const dayRestricted = days.size !== 31;
  const weekdayRestricted = weekdays.size !== 7;
  const dayMatch = days.has(clock.day);
  const weekdayMatch = weekdays.has(clock.weekday);
  if (dayRestricted && weekdayRestricted) {
    return dayMatch || weekdayMatch;
  }

  return dayMatch && weekdayMatch;
};

/** Whether `Intl` knows this zone. The validator asks so an author hears about a typo in the editor. */
export const isKnownTimeZone = (timeZone: string): boolean => zonedClock(new Date(), timeZone) !== undefined;
