import { dateParts, toDate } from './dateParts';
import { numberOf, toStr } from './values';

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
  },

  // `| ago(locale?)` — how long ago a moment was, or how far ahead it is, in words: "4 minutes ago", "in 3 hours",
  // "now" — at the render's moment, on the server then again in the browser (a page that stays open is not redrawn
  // as time passes). The unit is the largest that is whole; the locale `en` when not named. encore's agents wrote a
  // plugin for "Ended 4 min ago": every page with a history, a feed or a chat needs it.
  ago: (value, args) => {
    const date = toDate(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
      ['year', 31_536_000],
      ['month', 2_592_000],
      ['week', 604_800],
      ['day', 86_400],
      ['hour', 3_600],
      ['minute', 60]
    ];
    const [unit, size] = units.find(([, length]) => Math.abs(seconds) >= length) ?? ['second', 1];
    const amount = unit === 'second' ? (Math.abs(seconds) < 10 ? 0 : seconds) : Math.trunc(seconds / size);
    for (const locale of [args.length > 0 ? toStr(args[0]) : 'en', 'en']) {
      try {
        return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(amount, unit);
      } catch {
        continue;
      }
    }

    return '';
  },

  // `| duration` — a length in seconds as a clock writes it: 238 → "3:58", 3723 → "1:02:03". A track's length, a
  // task's time: `date` is a moment, and a duration read as one was 06:40 for a 238 s track (encore's dev-2).
  duration: value => {
    const total = numberOf(value);
    if (total === undefined || total < 0) {
      return '';
    }

    const whole = Math.round(total);
    const hours = Math.floor(whole / 3600);
    const minutes = Math.floor((whole % 3600) / 60);
    const seconds = String(whole % 60).padStart(2, '0');

    return hours > 0
      ? `${String(hours)}:${String(minutes).padStart(2, '0')}:${seconds}`
      : `${String(minutes)}:${seconds}`;
  }
};
