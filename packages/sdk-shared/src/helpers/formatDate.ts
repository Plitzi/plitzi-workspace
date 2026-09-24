/**
 * One function per import, from its own subpath — never the package root.
 *
 * This module is published file by file, so nothing tree-shakes it for a server: `from 'date-fns'` loaded all 826 of
 * the package's modules, and `from 'date-fns/locale'` every locale there is, for a handful of functions and three
 * languages. On a page server that was the single largest cost of starting at all — about 300 MB of resident memory,
 * held for the life of the process.
 */
import { differenceInMilliseconds } from 'date-fns/differenceInMilliseconds';
import { format } from 'date-fns/format';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { getTime } from 'date-fns/getTime';
import { enUS } from 'date-fns/locale/en-US';
import { es } from 'date-fns/locale/es';
import { pt } from 'date-fns/locale/pt';
import { parseISO } from 'date-fns/parseISO';
import { toZonedTime } from 'date-fns-tz/toZonedTime';

import type { FormatDistanceToNowOptions, Locale } from 'date-fns';

export type SupportedLocale = 'en' | 'es' | 'pt';

const locales: Record<SupportedLocale, Locale> = { en: enUS, es, pt };

/**
 * Converts a date input to a valid JavaScript Date object.
 *
 * Supports multiple input formats:
 *
 * - Date: returned as-is
 * - Number: interpreted as timestamp
 *
 *   - < 1e12 → treated as seconds and converted to milliseconds
 *   - > = 1e12 → treated as milliseconds
 * - String: parsed as ISO 8601 date string
 *
 * @param {Date | number | string} d - The date input to normalize
 * @returns {Date} A valid JavaScript Date object
 */
export const parseDate = (date: string | number | Date): Date => {
  let d: Date;
  if (typeof date === 'number') {
    d = date < 1e12 ? new Date(date * 1000) : new Date(date);
  } else if (typeof date === 'string') {
    d = parseISO(date);
  } else {
    d = date;
  }

  return d;
};

/**
 * Formats a date to a readable string, with locale support.
 *
 * @param date - Date as timestamp (ms), timestamp in seconds, or ISO string
 * @param formatStr - Date-fns format string (default 'dd MMMM, yyyy')
 * @param locale - 'en' | 'es' | 'pt' (default 'en')
 */
export function formatDate(
  date?: string | number | Date,
  formatStr: string = 'dd MMMM, yyyy',
  locale: SupportedLocale = 'en'
): string {
  if (!date) {
    return '';
  }

  const d = parseDate(date);

  return format(d, formatStr, { locale: locales[locale] });
}

export function formatDateUTC(
  date?: string | number | Date,
  formatStr: string = 'dd MMMM, yyyy',
  locale: SupportedLocale = 'en'
): string {
  if (!date) {
    return '';
  }

  const d = parseDate(date);

  return format(toZonedTime(d, 'UTC'), formatStr, { locale: locales[locale] });
}

/** Formats a UTC timestamp/string to local timezone */
export function formatUTCToLocal(
  date?: string | number | Date,
  formatStr: string = 'dd MMMM, yyyy HH:mm',
  locale: SupportedLocale = 'en'
): string {
  if (!date) {
    return '';
  }

  const d = parseDate(date);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localDate = toZonedTime(d, timeZone);

  return format(localDate, formatStr, { locale: locales[locale] });
}

/**
 * Returns the difference between two dates in milliseconds
 *
 * @param start - Date, timestamp (ms or s) or ISO string
 * @param end - Date, timestamp (ms or s) or ISO string
 */
export function getDurationMs(start: string | number | Date, end: string | number | Date): number {
  const startDate = parseDate(start);
  const endDate = parseDate(end);

  return differenceInMilliseconds(endDate, startDate);
}

/**
 * Returns a human-readable "time ago" string.
 *
 * Supports:
 *
 * - Date objects
 * - Timestamps (ms or seconds)
 * - ISO strings
 *
 * Examples: formatFromNow('2024-01-01') → "2 months ago" formatFromNow(1700000000, 'es') → "hace 3 meses"
 *
 * @param date - Date, ISO string, or timestamp
 * @param locale - 'en' | 'es' | 'pt' (default 'en')
 * @returns {string} A human-friendly "from now" string
 */
export function formatFromNow(
  date?: string | number | Date,
  locale: SupportedLocale = 'en',
  options?: FormatDistanceToNowOptions
): string {
  if (!date) {
    return '';
  }

  const d = parseDate(date);

  if (isNaN(d.getTime())) {
    return '';
  }

  return formatDistanceToNow(d, { ...options, locale: locales[locale] });
}

export function isValidFormat(formatStr: string): boolean {
  try {
    // Use a known valid date
    format(new Date(), formatStr);

    return true;
  } catch {
    return false;
  }
}

// input to ms
export const toUnixSeconds = (input: string | number | Date): string => {
  return Math.floor(getTime(parseDate(input)) / 1000).toString();
};
