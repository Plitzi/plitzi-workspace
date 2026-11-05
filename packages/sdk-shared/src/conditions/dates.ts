// One function per import, from its own subpath: `from 'date-fns'` loads every one of the package's 800-odd modules
// wherever this file is imported — including the rule evaluator a page SERVER uses, where nothing tree-shakes
// it and it cost about 300 MB of resident memory for four functions.
import { getTime } from 'date-fns/getTime';
import { parseISO } from 'date-fns/parseISO';

export const toUnixSeconds = (input: string | number | Date): string => {
  let d: Date;

  // A number below 10^12 is seconds, above it milliseconds; a string is ISO 8601.
  if (typeof input === 'number') {
    d = input < 1e12 ? new Date(input * 1000) : new Date(input);
  } else if (typeof input === 'string') {
    d = parseISO(input);
  } else {
    d = input;
  }

  // getTime() → ms
  return Math.floor(getTime(d) / 1000).toString();
};

export const isDate = (value: unknown): value is Date => {
  if (typeof value !== 'string') {
    return false;
  }

  // Strict regex: YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  // A real calendar day, not just the shape of one: `2024-02-30` rolls over to March, so it must come back unchanged.
  // Built by hand rather than with date-fns `parse`, which compiles every token parser it has — about 100 MB of memory —
  // and this runs on page servers, inside the rule evaluator.
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};
