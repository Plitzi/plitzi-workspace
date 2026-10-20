import { dateParts, toDate } from './dateParts';
import { toStr } from './values';

import type { TwigFilter } from './types';

export const dateFilters: Record<string, TwigFilter> = {
  // `| date(format, timeZone?)` — formats a date string/timestamp.
  // Tokens: Y, y (two digits), m, d, j (day, unpadded), n (month, unpadded), H, G (hour, unpadded), h / g (12-hour,
  // padded / unpadded), A / a (AM / am), i, s, w (weekday, 0 = Sunday), N (ISO weekday, 1 = Monday), U (Unix
  // seconds), l (day name), D (short day name), F (month name), M (short month). A backslash prints the next
  // character as it is (`\T`).
  // The parts are read in `timeZone` when one is named, and in the zone the code runs in otherwise. A bare
  // `YYYY-MM-DD` parses as midnight UTC, so a calendar date is read with `'UTC'` — in any other zone west of
  // Greenwich it would be the day before. An unknown zone formats to `''`, like an unparseable date.
  date: (value, args) => {
    if (args.length === 0) {
      return value;
    }
    const format = toStr(args[0]);
    const date = toDate(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const parts = dateParts(date, args.length > 1 ? toStr(args[1]) : '');
    if (!parts) {
      return '';
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December'
    ];
    const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const tokens: Record<string, string> = {
      Y: String(parts.year),
      y: pad(parts.year % 100),
      m: pad(parts.month),
      n: String(parts.month),
      d: pad(parts.day),
      j: String(parts.day),
      H: pad(parts.hours),
      G: String(parts.hours),
      h: pad(parts.hours % 12 || 12),
      g: String(parts.hours % 12 || 12),
      A: parts.hours < 12 ? 'AM' : 'PM',
      a: parts.hours < 12 ? 'am' : 'pm',
      i: pad(parts.minutes),
      s: pad(parts.seconds),
      w: String(parts.weekday),
      N: String(parts.weekday === 0 ? 7 : parts.weekday),
      U: String(Math.floor(date.getTime() / 1000)),
      l: dayNames[parts.weekday],
      D: dayNames[parts.weekday].slice(0, 3),
      F: monthNames[parts.month - 1],
      M: monthShort[parts.month - 1]
    };

    // Single-pass substitution: replacing token letters sequentially with `String.replace` cross-contaminates
    // (an inserted month name such as "March" would have its "M" re-substituted) and only replaces the first
    // occurrence of a repeated token. Scanning char by char avoids both.
    let out = '';
    let escaped = false;
    for (const char of format) {
      if (escaped) {
        out += char;
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else {
        out += Object.prototype.hasOwnProperty.call(tokens, char) ? tokens[char] : char;
      }
    }

    return out;
  }
};
