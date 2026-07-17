import { evalOperand } from './evalOperand';
import { FILTER_RE } from './patterns';

// A twig filter: takes the piped value, its optional raw argument (e.g. the `', '` in `| join(', ')`) and the
// render context, and returns the transformed value. Registered by name in `filters`, so the set is extensible —
// an unknown filter is simply skipped rather than throwing.
export type TwigFilter = (value: unknown, arg: string | undefined, context: Record<string, unknown>) => unknown;

const isEmpty = (value: unknown): boolean => value === undefined || value === null || value === '';

export const filters: Record<string, TwigFilter> = {
  // Serialises an object so an asRaw result can be JSON.parsed back into typed data; leaves primitives untouched.
  object_as_json: value => (typeof value === 'object' && value !== null ? JSON.stringify(value) : value),
  // The idiomatic default: substitutes the argument when the value is undefined, null or an empty string.
  default: (value, arg, context) => (isEmpty(value) ? evalOperand(arg ?? '', context) : value),
  upper: value => (typeof value === 'string' ? value.toUpperCase() : value),
  lower: value => (typeof value === 'string' ? value.toLowerCase() : value),
  trim: value => (typeof value === 'string' ? value.trim() : value),
  // Twig-style: first character uppercase, the rest lowercase.
  capitalize: value =>
    typeof value === 'string' && value.length > 0 ? value[0].toUpperCase() + value.slice(1).toLowerCase() : value,
  length: value => {
    if (typeof value === 'string' || Array.isArray(value)) {
      return value.length;
    }

    if (value !== null && typeof value === 'object') {
      return Object.keys(value).length;
    }

    return value;
  },
  join: (value, arg, context) =>
    Array.isArray(value) ? value.join(arg === undefined ? '' : String(evalOperand(arg, context))) : value
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
