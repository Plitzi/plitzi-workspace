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

/** An instant, read as a wall clock in one fixed zone. Built once per search so `Intl` is constructed once. */
type ClockReader = (at: Date) => WallClock | undefined;

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
const zonedReader = (timeZone: string): ClockReader | undefined => {
  let format: Intl.DateTimeFormat;
  try {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short'
    });
  } catch {
    return undefined;
  }

  return (at: Date): WallClock | undefined => {
    const parts = format.formatToParts(at);
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
  };
};

export const zonedClock = (at: Date, timeZone: string): WallClock | undefined => zonedReader(timeZone)?.(at);

/**
 * Whether an expression fires at this minute — in `timeZone` when one is named, in UTC when none is.
 *
 * Day-of-month and day-of-week are OR'd when both are restricted, which is the rule every cron implementation
 * follows and the one that surprises people who expect AND — `0 0 1 * 1` fires on the first of the month AND on
 * every Monday.
 */
/**
 * Whether the DATE half of an expression admits this clock, ignoring hour and minute.
 *
 * Its own answer because the search below skips by it: a day that cannot match is a day worth stepping over whole,
 * and that is the difference between reading `Intl` twice and reading it fourteen hundred times.
 */
const dateMatches = ([, , days, months, weekdays]: CronExpression, clock: WallClock): boolean => {
  if (!months.has(clock.month)) {
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

const clockMatches = (parsed: CronExpression, clock: WallClock): boolean => {
  const [minutes, hours] = parsed;

  return minutes.has(clock.minute) && hours.has(clock.hour) && dateMatches(parsed, clock);
};

const readerFor = (timeZone?: string): ClockReader | undefined => (timeZone ? zonedReader(timeZone) : utcClock);

export const cronMatches = (expression: string, at: Date, timeZone?: string): boolean => {
  const parsed = parseCron(expression);
  const clock = parsed ? readerFor(timeZone)?.(at) : undefined;

  return parsed !== undefined && clock !== undefined && clockMatches(parsed, clock);
};

const MINUTE_MS = 60_000;

/**
 * How far ahead {@link cronNextFire} will look before answering "never".
 *
 * Four years, so `0 0 29 2 *` — the one expression whose next fire can be three years out — is found rather than
 * reported as unreachable. Every other expression settles within a day or two of stepping.
 */
const SEARCH_HORIZON_MS = 4 * 366 * 24 * 60 * MINUTE_MS;

/**
 * The first minute at or after `from` that this expression fires on, or undefined when it never does.
 *
 * **This is what a schedule stores**, and why it is here rather than in a scheduler: a due time written into a row
 * is a decision made once, by whoever wrote it, and every replica afterwards reads the same instant instead of each
 * asking its own clock whether the moment has come. Nodes in different countries then disagree about what time it
 * is — which they will — without ever disagreeing about which fires have happened.
 *
 * Inclusive of `from`, so a caller that wants the one strictly after an instant asks from the minute after it. The
 * search steps by whole minutes, skipping a day at a time when the date cannot match and an hour at a time when the
 * hour cannot — a yearly expression costs a few hundred comparisons rather than half a million.
 *
 * DST is the reason the skips are computed from the WALL clock and then re-read rather than added as fixed offsets:
 * jumping "to midnight" lands an hour early on the night a zone falls back, which costs one more comparison, and an
 * hour late on the night it springs forward — into minutes that did not exist locally, so there was nothing there
 * to miss.
 */
export const cronNextFire = (expression: string, from: Date, timeZone?: string): Date | undefined => {
  const parsed = parseCron(expression);
  const read = parsed ? readerFor(timeZone) : undefined;
  if (!parsed || !read) {
    return undefined;
  }

  const start = Math.ceil(from.getTime() / MINUTE_MS) * MINUTE_MS;
  const horizon = start + SEARCH_HORIZON_MS;
  const [minutes, hours] = parsed;

  for (let at = start; at <= horizon; ) {
    const candidate = new Date(at);
    const clock = read(candidate);
    if (!clock) {
      return undefined;
    }

    if (!dateMatches(parsed, clock)) {
      at += (24 * 60 - clock.hour * 60 - clock.minute) * MINUTE_MS;
      continue;
    }

    if (!hours.has(clock.hour)) {
      at += (60 - clock.minute) * MINUTE_MS;
      continue;
    }

    if (minutes.has(clock.minute)) {
      return candidate;
    }

    at += MINUTE_MS;
  }

  return undefined;
};

/**
 * How many times an expression would have fired in `(after, until]`.
 *
 * What an operator is owed after an outage: the run that is about to happen is one fire, and this is the number of
 * others that went by while nothing was there to take them. Capped, because the answer's purpose is to be shown to
 * somebody — a minutely schedule down for a week is "at least `limit`", not a number worth spending a second on.
 */
export const cronFiresBetween = (
  expression: string,
  after: Date,
  until: Date,
  timeZone?: string,
  limit = 1000
): number => {
  let count = 0;
  let at = new Date(after.getTime() + MINUTE_MS);
  while (count < limit) {
    const next = cronNextFire(expression, at, timeZone);
    if (!next || next > until) {
      return count;
    }

    count += 1;
    at = new Date(next.getTime() + MINUTE_MS);
  }

  return count;
};

/** Whether `Intl` knows this zone. The validator asks so an author hears about a typo in the editor. */
export const isKnownTimeZone = (timeZone: string): boolean => zonedClock(new Date(), timeZone) !== undefined;
