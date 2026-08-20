/**
 * Cron matching, to the minute.
 *
 * Five fields — minute, hour, day of month, month, day of week — with `*`, lists, ranges and steps. That is the
 * vocabulary people actually write in a scheduling field, and the parts left out (`@daily`, seconds, `L`/`W`)
 * are the parts whose absence is obvious rather than subtly wrong.
 *
 * Nothing here keeps time: a caller says which minute it is asking about, which is what makes a schedule testable
 * without waiting for one.
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

/**
 * Whether an expression fires at this minute, in UTC.
 *
 * Day-of-month and day-of-week are OR'd when both are restricted, which is the rule every cron implementation
 * follows and the one that surprises people who expect AND — `0 0 1 * 1` fires on the first of the month AND on
 * every Monday.
 */
export const cronMatches = (expression: string, at: Date): boolean => {
  const parsed = parseCron(expression);
  if (!parsed) {
    return false;
  }

  const [minutes, hours, days, months, weekdays] = parsed;
  if (!minutes.has(at.getUTCMinutes()) || !hours.has(at.getUTCHours()) || !months.has(at.getUTCMonth() + 1)) {
    return false;
  }

  const dayRestricted = days.size !== 31;
  const weekdayRestricted = weekdays.size !== 7;
  const dayMatch = days.has(at.getUTCDate());
  const weekdayMatch = weekdays.has(at.getUTCDay());
  if (dayRestricted && weekdayRestricted) {
    return dayMatch || weekdayMatch;
  }

  return dayMatch && weekdayMatch;
};
