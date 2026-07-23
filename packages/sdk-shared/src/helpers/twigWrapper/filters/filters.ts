// A twig filter: takes the piped value plus its already-evaluated arguments and returns the transformed value.
// Arguments are parsed and evaluated by the Evaluator before the filter runs, so a filter never parses raw
// strings itself. Registered by name in `filters`, so the set is extensible — an unknown filter is simply
// skipped rather than throwing.
export type TwigFilter = (value: unknown, args: readonly unknown[]) => unknown;

const isEmpty = (value: unknown): boolean => value === undefined || value === null || value === '';

const toStr = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(value);
};

// ── Raw marker ───────────────────────────────────────────────────────────────
// Marker returned by `| raw` so the Evaluator bypasses JSON serialization and outputs the value as-is.
export type RawMarker = { readonly __raw: unknown; readonly __marker: typeof RAW_MARKER };

export const RAW_MARKER = '__PLITZI_RAW__';

export const isRawMarker = (value: unknown): value is RawMarker =>
  typeof value === 'object' && value !== null && (value as { __marker?: unknown }).__marker === RAW_MARKER;

export const wrapRaw = (value: unknown): RawMarker => ({ __raw: value, __marker: RAW_MARKER });

export const unwrapRaw = (value: unknown): unknown => (isRawMarker(value) ? value.__raw : value);

export const filters: Record<string, TwigFilter> = {
  // ── Identity / HTML ──────────────────────────────────────────────────────────────
  // Outputs the value as-is, bypassing JSON serialization even in double braces.
  raw: value => wrapRaw(value),

  // ── Serialisation ────────────────────────────────────────────────────────────────
  to_json: value => (typeof value === 'object' && value !== null ? JSON.stringify(value) : toStr(value)),
  json_encode: value => (typeof value === 'object' && value !== null ? JSON.stringify(value) : toStr(value)),
  // Serialises an object so an asRaw result can be JSON.parsed back into typed data; leaves primitives untouched.
  object_as_json: value => (typeof value === 'object' && value !== null ? JSON.stringify(value) : value),

  // ── Default ──────────────────────────────────────────────────────────────────────
  // The idiomatic default: substitutes the argument when the value is undefined, null or an empty string.
  default: (value, args) => (isEmpty(value) ? args[0] : value),

  // ── String transforms ────────────────────────────────────────────────────────────
  upper: value => (typeof value === 'string' ? value.toUpperCase() : value),
  lower: value => (typeof value === 'string' ? value.toLowerCase() : value),
  trim: value => (typeof value === 'string' ? value.trim() : value),
  // Twig-style: first character uppercase, the rest lowercase.
  capitalize: value =>
    typeof value === 'string' && value.length > 0 ? value[0].toUpperCase() + value.slice(1).toLowerCase() : value,
  // `| title` uppercases the first letter of each word.
  title: value => (typeof value === 'string' ? value.replace(/\b\w/g, char => char.toUpperCase()) : value),
  // Converts to CamelCase (e.g. `foo_bar` → `fooBar`).
  camelize: value =>
    typeof value === 'string'
      ? value.replace(/[-_]+(.)?/g, (_, char: string | undefined) => (char ? char.toUpperCase() : ''))
      : value,
  // Converts to kebab-case (e.g. `fooBar` → `foo-bar`).
  kebab: value =>
    typeof value === 'string'
      ? value
          .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
          .replace(/[\s_]+/g, '-')
          .toLowerCase()
      : value,
  // Converts to snake_case (e.g. `fooBar` → `foo_bar`).
  snake: value =>
    typeof value === 'string'
      ? value
          .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
          .replace(/[\s-]+/g, '_')
          .toLowerCase()
      : value,
  // `| ltrim` — trims whitespace from the start.
  ltrim: value => (typeof value === 'string' ? value.trimStart() : value),
  // `| rtrim` — trims whitespace from the end.
  rtrim: value => (typeof value === 'string' ? value.trimEnd() : value),
  // `| pad(length, 'char')` — pads string from left to given length.
  pad: (value, args) => {
    if (typeof value !== 'string') {
      return value;
    }
    const length = Number(args[0]) || 0;
    const padStr = args.length > 1 ? toStr(args[1]) : ' ';
    if (padStr === '') {
      return value;
    }
    const padLen = length - value.length;
    if (padLen <= 0) {
      return value;
    }
    const repeat = Math.ceil(padLen / padStr.length);
    return padStr.repeat(repeat).slice(0, padLen) + value;
  },
  // `| padRight(length, 'char')` — pads string from right to given length.
  padRight: (value, args) => {
    if (typeof value !== 'string') {
      return value;
    }
    const length = Number(args[0]) || 0;
    const padStr = args.length > 1 ? toStr(args[1]) : ' ';
    if (padStr === '') {
      return value;
    }
    const padLen = length - value.length;
    if (padLen <= 0) {
      return value;
    }
    const repeat = Math.ceil(padLen / padStr.length);
    return value + padStr.repeat(repeat).slice(0, padLen);
  },
  // `| number` — extracts the first number from a string.
  number: value => {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value !== 'string') {
      return value;
    }
    const match = value.match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  },

  // ── String operations ────────────────────────────────────────────────────────────
  // `| replace('search', 'replacement')` — replaces every occurrence of search with replacement.
  replace: (value, args) => {
    if (typeof value !== 'string' || args.length === 0) {
      return value;
    }

    return value.split(toStr(args[0])).join(toStr(args[1]));
  },
  // `| slice(2)` or `| slice(2, 5)` — substring or sub-array via start/length.
  slice: (value, args) => {
    if (args.length === 0) {
      return value;
    }

    const start = Number(args[0]) || 0;
    const hasLength = args.length > 1 && Number.isFinite(Number(args[1]));
    const end = hasLength ? start + Number(args[1]) : undefined;

    if (typeof value === 'string') {
      return value.slice(start, end);
    }

    if (Array.isArray(value)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return value.slice(start, end);
    }

    return value;
  },
  // `| split(',')` — splits a string into an array.
  split: (value, args) => (typeof value === 'string' && args.length > 0 ? value.split(toStr(args[0])) : value),
  // `| join(', ')` — joins an array into a string.
  join: (value, args) => (Array.isArray(value) ? value.join(args.length === 0 ? '' : toStr(args[0])) : value),
  // `| reverse` — reverses a string or array.
  reverse: value => {
    if (typeof value === 'string') {
      return value.split('').reverse().join('');
    }

    if (Array.isArray(value)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment
      return [...value].reverse();
    }

    return value;
  },

  // ── String queries ───────────────────────────────────────────────────────────────
  length: value => {
    if (typeof value === 'string' || Array.isArray(value)) {
      return value.length;
    }

    if (value !== null && typeof value === 'object') {
      return Object.keys(value).length;
    }

    return value;
  },
  // `| first` — first character of a string or first element of an array.
  first: value => {
    if (typeof value === 'string') {
      return value.length > 0 ? value[0] : '';
    }

    if (Array.isArray(value)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return value.length > 0 ? value[0] : undefined;
    }

    return value;
  },
  // `| last` — last character of a string or last element of an array.
  last: value => {
    if (typeof value === 'string') {
      return value.length > 0 ? value[value.length - 1] : '';
    }

    if (Array.isArray(value)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return value.length > 0 ? value[value.length - 1] : undefined;
    }

    return value;
  },
  // `| contains('substr')` or `| contains(item)` — checks string substring or array membership.
  contains: (value, args) => {
    if (args.length === 0) {
      return false;
    }

    const needle = args[0];

    if (typeof value === 'string') {
      return value.includes(toStr(needle));
    }

    if (Array.isArray(value)) {
      return value.includes(needle);
    }

    return false;
  },
  // `| startswith('prefix')` — checks if a string starts with a prefix.
  startswith: (value, args) =>
    typeof value === 'string' && args.length > 0 ? value.startsWith(toStr(args[0])) : false,
  // `| endswith('suffix')` — checks if a string ends with a suffix.
  endswith: (value, args) => (typeof value === 'string' && args.length > 0 ? value.endsWith(toStr(args[0])) : false),

  // ── Number formatting ────────────────────────────────────────────────────────────
  // `| number_format(2, '.', ',')` — formats a number with decimals and separators.
  number_format: (value, args) => {
    if (typeof value !== 'number') {
      return value;
    }

    const decimals = Number(args[0]) || 0;
    const decPoint = args[1] != null ? toStr(args[1]) : '.';
    const thousandsSep = args[2] != null ? toStr(args[2]) : '';

    const fixed = value.toFixed(decimals);
    if (thousandsSep === '') {
      return fixed.replace('.', decPoint);
    }

    const parts = fixed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSep);
    return parts.join(decPoint);
  },

  // ── Array transforms ─────────────────────────────────────────────────────────────
  // `| sort` — sorts an array.
  sort: value => {
    if (!Array.isArray(value)) {
      return value;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment
    return [...value].sort((a, b) => {
      if (a === b) {
        return 0;
      }
      if (a === null || a === undefined) {
        return -1;
      }
      if (b === null || b === undefined) {
        return 1;
      }

      return String(a).localeCompare(String(b));
    });
  },
  // `| batch(3)` — chunks an array into groups of N.
  batch: (value, args) => {
    if (!Array.isArray(value) || args.length === 0) {
      return value;
    }

    const size = Number(args[0]);
    if (size <= 0) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return value;
    }

    const chunks: unknown[][] = [];
    for (let i = 0; i < value.length; i += size) {
      chunks.push(value.slice(i, i + size));
    }

    return chunks;
  },
  // `| merge(other)` — merges two arrays or objects.
  merge: (value, args) => {
    if (args.length === 0) {
      return value;
    }

    const other = args[0];

    if (Array.isArray(value) && Array.isArray(other)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment
      return [...value, ...other];
    }

    if (
      typeof value === 'object' &&
      value !== null &&
      typeof other === 'object' &&
      other !== null &&
      !Array.isArray(other)
    ) {
      return { ...(value as Record<string, unknown>), ...(other as Record<string, unknown>) };
    }

    return value;
  },
  // `| keys` — returns the keys of an object as an array.
  keys: value => (value !== null && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value) : value),
  // `| values` — returns the values of an object as an array.
  values: value => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return Object.values(value);
    }

    return value;
  },
  // `| filter('key')` — filters an array, keeping items truthy for the given key (or the items themselves).
  filter: (value, args) => {
    if (!Array.isArray(value)) {
      return value;
    }

    if (args.length === 0) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return value.filter(Boolean);
    }

    const key = toStr(args[0]);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return value.filter(item => {
      if (item !== null && typeof item === 'object') {
        const resolved = (item as Record<string, unknown>)[key];
        return resolved !== undefined && resolved !== null && resolved !== false && resolved !== '';
      }

      return Boolean(item);
    });
  },
  // `| column(name)` — extracts a property from each item in an array of objects.
  column: (value, args) => {
    if (!Array.isArray(value) || args.length === 0) {
      return value;
    }

    const key = toStr(args[0]);

    return value.map(item =>
      item !== null && typeof item === 'object' ? (item as Record<string, unknown>)[key] : undefined
    );
  },

  // ── Misc ──────────────────────────────────────────────────────────────────────────
  // `| url_encode` — percent-encodes a string or converts an object to query-string format.
  url_encode: value => {
    if (typeof value === 'string') {
      return encodeURIComponent(value);
    }

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return new URLSearchParams(
        Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, toStr(v)]))
      ).toString();
    }

    return value;
  },
  // `| nl2br` — inserts HTML `<br>` before every newline.
  nl2br: value => (typeof value === 'string' ? value.replace(/\n/g, '<br>') : value),
  // `| striptags` — strips HTML/XML tags; optional `allowable` arg keeps specific tags.
  striptags: (value, args) => {
    if (typeof value !== 'string') {
      return value;
    }

    const allowable = args.length > 0 ? toStr(args[0]).trim() : '';
    if (allowable) {
      const tagNames = allowable
        .split(/(?:\s*>\s*<\s*|<\s*|>\s*)/)
        .filter(Boolean)
        .map(t => t.replace(/[/>]/g, '').trim());
      if (tagNames.length > 0) {
        const pattern = new RegExp(`<(?!/?(?:${tagNames.join('|')})\\b)[^>]+>`, 'gi');
        return value.replace(pattern, '').replace(/\s+/g, ' ').trim();
      }
    }

    return value
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  },
  // `| abs` — returns the absolute value of a number.
  abs: value => (typeof value === 'number' ? Math.abs(value) : value),
  // `| round(precision, mode)` — rounds a number; default precision 0, mode 'common' (Math.round).
  round: (value, args) => {
    if (typeof value !== 'number') {
      return value;
    }

    const precision = Number(args[0]) || 0;
    const mode = args[1] != null ? toStr(args[1]) : 'common';
    const factor = 10 ** precision;

    if (mode === 'ceil') {
      return Math.ceil(value * factor) / factor;
    }

    if (mode === 'floor') {
      return Math.floor(value * factor) / factor;
    }

    return Math.round(value * factor) / factor;
  },
  // `| format(args...)` — sprintf-like string formatting with positional placeholders.
  format: (value, args) => {
    if (typeof value !== 'string') {
      return value;
    }

    let index = 0;
    return value.replace(/%s|%d|%f|%%/g, match => {
      if (match === '%%') {
        return '%';
      }

      const replacement = args[index];
      index++;
      if (replacement === undefined) {
        return match;
      }
      if (match === '%d') {
        return String(Math.floor(Number(replacement)));
      }
      if (match === '%f') {
        return String(Number(replacement));
      }

      return toStr(replacement);
    });
  },

  // ── Whitespace ────────────────────────────────────────────────────────────
  // `| spaceless` — removes extra whitespace between HTML tags.
  spaceless: value => (typeof value === 'string' ? value.replace(/>\s+</g, '><').trim() : value),

  // ── Random ────────────────────────────────────────────────────────────────
  // `| random` — returns a random element from an array or a random character from a string.
  random: value => {
    if (Array.isArray(value)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return value.length > 0 ? value[Math.floor(Math.random() * value.length)] : undefined;
    }
    if (typeof value === 'string') {
      return value.length > 0 ? value[Math.floor(Math.random() * value.length)] : '';
    }
    if (typeof value === 'number') {
      return Math.floor(Math.random() * value);
    }
    return value;
  },

  // ── Date ──────────────────────────────────────────────────────────────────
  // `| date(format)` — formats a date string/timestamp using Intl.DateTimeFormat.
  // Supported format tokens: Y, m, d, H, i, s, l (day name), F (month name), M (short month).
  date: (value, args) => {
    if (args.length === 0) {
      return value;
    }
    const format = toStr(args[0]);
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) {
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

    return format
      .replace('Y', String(date.getFullYear()))
      .replace('m', pad(date.getMonth() + 1))
      .replace('d', pad(date.getDate()))
      .replace('H', pad(date.getHours()))
      .replace('i', pad(date.getMinutes()))
      .replace('s', pad(date.getSeconds()))
      .replace('l', dayNames[date.getDay()])
      .replace('F', monthNames[date.getMonth()])
      .replace('M', monthShort[date.getMonth()]);
  },

  // ── Encoding ──────────────────────────────────────────────────────────────
  // `| base64_encode` — encodes string to base64.
  base64_encode: value => (typeof value === 'string' ? btoa(value) : value),
  // `| base64_decode` — decodes base64 string.
  base64_decode: value => (typeof value === 'string' ? atob(value) : value),
  // `| md5` — returns MD5 hash (simplified: returns hex of char codes).
  md5: value =>
    typeof value === 'string'
      ? Array.from(value)
          .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
          .join('')
      : value,

  // ── Object manipulation ───────────────────────────────────────────────────
  // `| without('key1', 'key2')` — returns object without specified keys.
  without: (value, args) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return value;
    }
    const keys = args.map(toStr);
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!keys.includes(k)) {
        result[k] = v;
      }
    }
    return result;
  },
  // `| only('key1', 'key2')` — returns object with only specified keys.
  only: (value, args) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return value;
    }
    const keys = args.map(toStr);
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (keys.includes(k)) {
        result[k] = v;
      }
    }
    return result;
  },

  // ── Array/Object queries ──────────────────────────────────────────────────
  // `| find('key', value)` — finds first array element where key matches value.
  find: (value, args) => {
    if (!Array.isArray(value) || args.length < 2) {
      return undefined;
    }
    const key = toStr(args[0]);
    const target = args[1];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return value.find(item => {
      if (item !== null && typeof item === 'object') {
        return (item as Record<string, unknown>)[key] === target;
      }
      return item === target;
    });
  },
  // `| pluck('key')` — extracts all values for a given key from an array of objects.
  pluck: (value, args) => {
    if (!Array.isArray(value) || args.length === 0) {
      return value;
    }
    const key = toStr(args[0]);

    return value.map(item =>
      item !== null && typeof item === 'object' ? (item as Record<string, unknown>)[key] : undefined
    );
  },
  // `| unique` — removes duplicates from an array.
  unique: value => (Array.isArray(value) ? [...new Set(value)] : value),
  // `| flatten` — flattens a nested array by one level.
  flatten: value => {
    return Array.isArray(value) ? value.flat() : value;
  },
  // `| sum` — sums all numeric values in an array.
  sum: value => {
    if (!Array.isArray(value)) {
      return value;
    }
    return value.reduce<number>((acc, item) => acc + (typeof item === 'number' ? item : 0), 0);
  },
  // `| chunk(size)` — splits array into chunks of given size.
  chunk: (value, args) => {
    if (!Array.isArray(value) || args.length === 0) {
      return value;
    }
    const size = Number(args[0]);
    if (size <= 0) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return value;
    }
    const chunks: unknown[][] = [];
    for (let i = 0; i < value.length; i += size) {
      chunks.push(value.slice(i, i + size));
    }
    return chunks;
  },
  // `| index_by(key)` — reindexes an array of objects by a key.
  index_by: (value, args) => {
    if (!Array.isArray(value) || args.length === 0) {
      return value;
    }
    const key = toStr(args[0]);
    const result: Record<string, unknown> = {};
    for (const item of value) {
      if (item !== null && typeof item === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        const k = String((item as Record<string, unknown>)[key] ?? '');
        result[k] = item;
      }
    }
    return result;
  },
  // `| group_by(key)` — groups array elements by a key.
  group_by: (value, args) => {
    if (!Array.isArray(value) || args.length === 0) {
      return value;
    }
    const key = toStr(args[0]);
    const result: Record<string, unknown[]> = {};
    for (const item of value) {
      if (item !== null && typeof item === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        const k = String((item as Record<string, unknown>)[key] ?? '');
        result[k] = result[k] ?? [];
        result[k].push(item);
      }
    }
    return result;
  }
};
