import { evalOperand } from './evalOperand';
import { FILTER_RE } from './patterns';

// A twig filter: takes the piped value, its optional raw argument (e.g. the `', '` in `| join(', ')`) and the
// render context, and returns the transformed value. Registered by name in `filters`, so the set is extensible —
// an unknown filter is simply skipped rather than throwing.
export type TwigFilter = (value: unknown, arg: string | undefined, context: Record<string, unknown>) => unknown;

const isEmpty = (value: unknown): boolean => value === undefined || value === null || value === '';

// Marker returned by `| raw` so that `renderTokens` bypasses JSON serialization and outputs the value as-is.
export const RAW_MARKER = '__PLITZI_RAW__';
export const isRawMarker = (value: unknown): value is { readonly __raw: unknown } =>
  typeof value === 'object' &&
  value !== null &&
  '__marker' in value &&
  (value as Record<string, unknown>).__marker === RAW_MARKER;

export const wrapRaw = (value: unknown): { readonly __raw: unknown; readonly __marker: string } => ({
  __raw: value,
  __marker: RAW_MARKER
});

export const unwrapRaw = (value: unknown): unknown => (isRawMarker(value) ? value.__raw : value);

export const filters: Record<string, TwigFilter> = {
  // ── Identity / HTML ──────────────────────────────────────────────────────────────
  // Outputs the value as-is, bypassing JSON serialization even in double braces.
  raw: value => wrapRaw(value),

  // ── Serialisation ────────────────────────────────────────────────────────────────
  to_json: value => (typeof value === 'object' && value !== null ? JSON.stringify(value) : stringify(value)),
  json_encode: value => (typeof value === 'object' && value !== null ? JSON.stringify(value) : stringify(value)),
  // Serialises an object so an asRaw result can be JSON.parsed back into typed data; leaves primitives untouched.
  object_as_json: value => (typeof value === 'object' && value !== null ? JSON.stringify(value) : value),

  // ── Default ──────────────────────────────────────────────────────────────────────
  // The idiomatic default: substitutes the argument when the value is undefined, null or an empty string.
  default: (value, arg, context) => (isEmpty(value) ? evalOperand(arg ?? '', context) : value),

  // ── String transforms ────────────────────────────────────────────────────────────
  upper: value => (typeof value === 'string' ? value.toUpperCase() : value),
  lower: value => (typeof value === 'string' ? value.toLowerCase() : value),
  trim: value => (typeof value === 'string' ? value.trim() : value),
  // Twig-style: first character uppercase, the rest lowercase.
  capitalize: value =>
    typeof value === 'string' && value.length > 0 ? value[0].toUpperCase() + value.slice(1).toLowerCase() : value,
  // Alias: `| title` uppercases the first letter of each word.
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

  // ── String operations ────────────────────────────────────────────────────────────
  // `| replace('search', 'replacement')` — Twig accepts two string args separated by comma.
  replace: (value, arg, context) => {
    if (typeof value !== 'string' || arg === undefined) {
      return value;
    }

    const parts = parseReplaceArgs(arg, context);
    let result = value;
    for (const [search, replacement] of parts) {
      result = result.split(search).join(replacement);
    }

    return result;
  },
  // `| slice(2)` or `| slice(2, 5)` — substring or sub-array via start/length.
  slice: (value, arg, context) => {
    if (arg === undefined) {
      return value;
    }

    const nums = splitFilterArgs(arg).map(a => Number(evalOperand(a.trim(), context)));
    const start = nums[0] ?? 0;
    const hasLength = nums.length > 1 && Number.isFinite(nums[1]);
    const end = hasLength ? start + nums[1] : undefined;

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
  split: (value, arg, context) => {
    if (typeof value !== 'string' || arg === undefined) {
      return value;
    }

    const delimiter = String(evalOperand(arg, context));
    return value.split(delimiter);
  },
  // `| join(', ')` — joins an array into a string.
  join: (value, arg, context) =>
    Array.isArray(value) ? value.join(arg === undefined ? '' : String(evalOperand(arg, context))) : value,
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
  // `| contains('substr')` or `| contains(item)` — checks if a string contains a substring or an array contains an item.
  contains: (value, arg, context) => {
    if (arg === undefined) {
      return false;
    }

    const needle = evalOperand(arg, context);

    if (typeof value === 'string') {
      return value.includes(String(needle));
    }

    if (Array.isArray(value)) {
      return value.includes(needle);
    }

    return false;
  },
  // `| startswith('prefix')` — checks if a string starts with a prefix.
  startswith: (value, arg, context) => {
    if (typeof value !== 'string' || arg === undefined) {
      return false;
    }

    return value.startsWith(String(evalOperand(arg, context)));
  },
  // `| endswith('suffix')` — checks if a string ends with a suffix.
  endswith: (value, arg, context) => {
    if (typeof value !== 'string' || arg === undefined) {
      return false;
    }

    return value.endsWith(String(evalOperand(arg, context)));
  },

  // ── Number formatting ────────────────────────────────────────────────────────────
  // `| number_format(2, '.', ',')` — formats a number with decimals and separators.
  number_format: (value, arg, context) => {
    if (typeof value !== 'number') {
      return value;
    }

    const args = splitFilterArgs(arg ?? '').map(a => evalOperand(a.trim(), context));
    const decimals = Number(args[0]) || 0;
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    const decPoint = args[1] != null ? String(args[1]) : '.';
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    const thousandsSep = args[2] != null ? String(args[2]) : '';

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
  batch: (value, arg, context) => {
    if (!Array.isArray(value) || arg === undefined) {
      return value;
    }

    const size = Number(evalOperand(arg, context));
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
  merge: (value, arg, context) => {
    if (arg === undefined) {
      return value;
    }

    const other = evalOperand(arg, context);

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
  keys: value => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value);
    }

    return value;
  },
  // `| values` — returns the values of an object as an array.
  values: value => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return Object.values(value);
    }

    return value;
  },
  // `| filter('key')` — filters an array, keeping items that are truthy for the given key path.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  filter: (value, arg, _context) => {
    if (!Array.isArray(value)) {
      return value;
    }

    if (arg === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return value.filter(Boolean);
    }

    const path = arg.replace(/^['"]|['"]$/g, '').trim();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return value.filter(item => {
      if (item !== null && typeof item === 'object') {
        const resolved = (item as Record<string, unknown>)[path];
        return resolved !== undefined && resolved !== null && resolved !== false && resolved !== '';
      }

      return Boolean(item);
    });
  }
};

// ── Helpers ────────────────────────────────────────────────────────────────────────

const stringify = (value: unknown): string => {
  if (value === undefined || value === null) {
    return '';
  }

  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(value);
};

// Parses `replace` arguments: `'search', 'replacement'` or variable paths.
const parseReplaceArgs = (arg: string, context: Record<string, unknown>): Array<[string, string]> => {
  const literal = /^(['"])([\s\S]*)\1\s*,\s*(['"])([\s\S]*)\3$/.exec(arg);
  if (literal) {
    return [[literal[2], literal[4]]];
  }

  // Fallback: treat the whole arg as a single string for simple replacements
  const resolved = String(evalOperand(arg, context));
  return [[resolved, '']];
};

// Splits comma-separated filter args while respecting quoted strings.
const splitFilterArgs = (arg: string): string[] => {
  if (arg === '') {
    return [];
  }

  const args: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (const char of arg) {
    if (inQuote) {
      current += char;
      if (char === quoteChar) {
        inQuote = false;
      }
    } else if (/^['"]$/.test(char)) {
      inQuote = true;
      quoteChar = char;
      current += char;
    } else if (char === ',') {
      args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  args.push(current.trim());
  return args;
};

// Runs each `| name(arg)` filter in the token, in order. An unknown filter name is ignored so a typo never throws.
export const applyFilters = (value: unknown, filtersStr: string, context: Record<string, unknown>): unknown => {
  let current = value;
  for (const match of filtersStr.matchAll(FILTER_RE)) {
    const name = match[1];
    if (Object.hasOwn(filters, name)) {
      // match[2] is the optional filter argument (undefined at runtime when the filter takes none).
      current = filters[name](current, match[2], context);
    }
  }

  return current;
};
