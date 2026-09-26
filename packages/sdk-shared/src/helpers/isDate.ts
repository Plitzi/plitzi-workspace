import { format } from 'date-fns/format';
import { isValid } from 'date-fns/isValid';
import { parse } from 'date-fns/parse';

/**
 * A module of its own because `parse` is the heaviest thing in date-fns — it compiles every token parser the format
 * language has, about 100 MB of memory on the way in — and nothing that formats a date should pay for it. Imported from
 * `formatDate`, it was paid by every page server at start, for a function no renderer calls.
 */
/** Strictly validates whether a string matches a given date-fns format. */
export function isDate(value: string, formatStr: string): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  try {
    // 1. Parse date using date-fns
    const parsed = parse(value, formatStr, new Date());

    // 2. Check if parsed date is valid
    if (!isValid(parsed)) {
      return false;
    }

    // 3. Strict format validation:
    // Re-format parsed date and compare with original input
    // If they differ → input didn't strictly match the format
    const reformatted = format(parsed, formatStr);

    return reformatted === value;
  } catch {
    return false;
  }
}
