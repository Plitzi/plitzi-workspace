// A twig filter: takes the piped value plus its already-evaluated arguments and returns the transformed value.
// Arguments are parsed and evaluated by the Evaluator before the filter runs, so a filter never parses raw
// strings itself. Registered by name in `filters`, so the set is extensible — an unknown filter is simply
// skipped rather than throwing.
export type TwigFilter = (value: unknown, args: readonly unknown[]) => unknown;

// Arrow callbacks created by the Evaluator carry their declared parameter count, so a filter can tell a
// key-extractor (`a => a.x`) from a comparator (`(a, b) => …`) — the created closures are all variadic, so
// their runtime `.length` is 0 and can't be used for this.
export const ARROW_PARAMS = Symbol('twigArrowParams');

export type ArrowCallback = ((...args: unknown[]) => unknown) & { [ARROW_PARAMS]?: number };

const isEmpty = (value: unknown): boolean => value === undefined || value === null || value === '';

// Orders two values for sorting: numbers numerically, everything else by locale string comparison, with
// null/undefined sorted first.
const compareValues = (a: unknown, b: unknown): number => {
  if (a === b) {
    return 0;
  }
  if (a === null || a === undefined) {
    return -1;
  }
  if (b === null || b === undefined) {
    return 1;
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }

  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(a).localeCompare(String(b));
};

const toStr = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(value);
};

// btoa/atob operate on Latin1, so a raw multibyte string would be mis-encoded (and code points > 255 throw).
// Round-tripping through the UTF-8 byte sequence keeps `base64_encode`/`base64_decode` correct for any string.
const utf8ToBase64 = (str: string): string => {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
};

const base64ToUtf8 = (str: string): string => {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new TextDecoder().decode(bytes);
};

// RFC 1321 MD5 over the UTF-8 bytes of the input. Dependency-free so it behaves identically in the browser
// (builder) and Node, and deterministic so template output stays stable.
const md5Hex = (input: string): string => {
  const shifts = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15,
    21
  ];
  const sines = new Uint32Array(64);
  for (let i = 0; i < 64; i++) {
    sines[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296);
  }

  const msg = new TextEncoder().encode(input);
  const bitLen = msg.length * 8;
  const paddedLen = (((msg.length + 8) >> 6) + 1) << 6;
  const bytes = new Uint8Array(paddedLen);
  bytes.set(msg);
  bytes[msg.length] = 0x80;
  const view = new DataView(bytes.buffer);
  view.setUint32(paddedLen - 8, bitLen >>> 0, true);
  view.setUint32(paddedLen - 4, Math.floor(bitLen / 4294967296) >>> 0, true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const rotl = (x: number, c: number): number => (x << c) | (x >>> (32 - c));

  for (let chunk = 0; chunk < paddedLen; chunk += 64) {
    const words = new Uint32Array(16);
    for (let i = 0; i < 16; i++) {
      words[i] = view.getUint32(chunk + i * 4, true);
    }

    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;
    for (let i = 0; i < 64; i++) {
      let f: number;
      let g: number;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }

      f = (f + a + sines[i] + words[g]) | 0;
      a = d;
      d = c;
      c = b;
      b = (b + rotl(f, shifts[i])) | 0;
    }

    a0 = (a0 + a) | 0;
    b0 = (b0 + b) | 0;
    c0 = (c0 + c) | 0;
    d0 = (d0 + d) | 0;
  }

  const toHexLE = (x: number): string => {
    let hex = '';
    for (let i = 0; i < 4; i++) {
      hex += ((x >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
    }

    return hex;
  };

  return toHexLE(a0) + toHexLE(b0) + toHexLE(c0) + toHexLE(d0);
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
  number: (value, args) => {
    if (typeof value === 'number') {
      const decimals = Number(args[0]) || 0;
      return value.toFixed(decimals);
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

    if (typeof value === 'number') {
      return toStr(value).length;
    }

    if (value !== null && typeof value === 'object') {
      return Object.keys(value).length;
    }

    return 0;
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
  // `| sort` — sorts an array. Optional arrow argument: `sort(a => a.key)` sorts by an extracted key,
  // `sort((a, b) => …)` uses the arrow as a comparator.
  sort: (value, args) => {
    if (!Array.isArray(value)) {
      return value;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const arr = [...value];
    const callback = args[0];
    if (typeof callback === 'function') {
      const cb = callback as ArrowCallback;
      if ((cb[ARROW_PARAMS] ?? 1) >= 2) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return arr.sort((a, b) => Number(cb(a, b)));
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return arr.sort((a, b) => compareValues(cb(a), cb(b)));
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return arr.sort(compareValues);
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
  // `| map(callback)` — applies a callback to each element and returns the results.
  // The callback is an arrow function, e.g. `| map(item => item.name)`.
  map: (value, args) => {
    if (!Array.isArray(value) || args.length === 0) {
      return value;
    }

    const callback = args[0];
    if (typeof callback !== 'function') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return value;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return value.map((item, index) => callback(item, index));
  },
  // `| reduce(callback, initial)` — reduces an array to a single value.
  // The callback is an arrow function, e.g. `| reduce((acc, item) => acc + item, 0)`.
  reduce: (value, args) => {
    if (!Array.isArray(value) || args.length === 0) {
      return value;
    }

    const callback = args[0];
    if (typeof callback !== 'function') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return value;
    }

    const initial = args[1];
    const startIndex = initial !== undefined ? 0 : 1;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    let accumulator = initial !== undefined ? initial : value[0];

    for (let i = startIndex; i < value.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      accumulator = callback(accumulator, value[i], i);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return accumulator;
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
  // `| filter('key')` or `| filter(callback)` — filters an array by key truthiness or arrow callback.
  filter: (value, args) => {
    if (!Array.isArray(value)) {
      return value;
    }

    if (args.length === 0) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return value.filter(Boolean);
    }

    const callback = args[0];
    if (typeof callback === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      return value.filter((item, index) => callback(item, index));
    }

    const key = toStr(callback);
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

    const tokens: Record<string, string> = {
      Y: String(date.getFullYear()),
      m: pad(date.getMonth() + 1),
      d: pad(date.getDate()),
      H: pad(date.getHours()),
      i: pad(date.getMinutes()),
      s: pad(date.getSeconds()),
      l: dayNames[date.getDay()],
      F: monthNames[date.getMonth()],
      M: monthShort[date.getMonth()]
    };

    // Single-pass substitution: replacing token letters sequentially with `String.replace` cross-contaminates
    // (an inserted month name such as "March" would have its "M" re-substituted) and only replaces the first
    // occurrence of a repeated token. Scanning char by char avoids both.
    let out = '';
    for (const char of format) {
      out += Object.prototype.hasOwnProperty.call(tokens, char) ? tokens[char] : char;
    }

    return out;
  },

  // ── Encoding ──────────────────────────────────────────────────────────────
  // `| base64_encode` — encodes a string to base64 (UTF-8 safe).
  base64_encode: value => (typeof value === 'string' ? utf8ToBase64(value) : value),
  // `| base64_decode` — decodes a base64 string (UTF-8 safe).
  base64_decode: value => (typeof value === 'string' ? base64ToUtf8(value) : value),
  // `| md5` — returns the MD5 hash of a string as a lowercase hex digest.
  md5: value => (typeof value === 'string' ? md5Hex(value) : value),

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
  // `| find(callback)` or `| find('key', value)` — finds first array element matching criteria.
  find: (value, args) => {
    if (!Array.isArray(value) || args.length === 0) {
      return undefined;
    }

    const callback = args[0];
    if (typeof callback === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      return value.find((item, index) => callback(item, index));
    }

    if (args.length < 2) {
      return undefined;
    }

    const key = toStr(callback);
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
