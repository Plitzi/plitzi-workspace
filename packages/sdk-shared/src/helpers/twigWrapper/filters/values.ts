export const isEmpty = (value: unknown): boolean => value === undefined || value === null || value === '';

// Orders two values for sorting: numbers numerically, everything else by locale string comparison, with
// null/undefined sorted first.
export const compareValues = (a: unknown, b: unknown): number => {
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

/** What JSON cannot hold — nothing, a function, a symbol — is Twig's `null`; a bigint is its digits. */
export const toJson = (value: unknown): string => {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return 'null';
  }

  return typeof value === 'bigint' ? value.toString() : JSON.stringify(value);
};

export const toStr = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(value);
};

/** A number, or text that is one — a price read out of a JSON file is often a string. */
export const numberOf = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

/**
 * A number as a locale writes it. A locale the runtime does not know falls back to `en`, and options it cannot honour —
 * a currency code that is not one — leave the number as written: a template renders something rather than throw.
 */
export const formatNumber = (value: number, locale: unknown, options: Intl.NumberFormatOptions): string => {
  for (const name of [locale == null ? 'en' : toStr(locale), 'en']) {
    try {
      return new Intl.NumberFormat(name, options).format(value);
    } catch {
      continue;
    }
  }

  return String(value);
};
