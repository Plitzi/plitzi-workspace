import { serializeValue } from '../processTwig/helpers';

export const isTruthy = (value: unknown): boolean => {
  if (value === null || value === undefined || value === false || value === '' || value === 0) {
    return false;
  }
  if (Array.isArray(value) && value.length === 0) {
    return false;
  }
  return true;
};

export const valueIn = (needle: unknown, haystack: unknown): boolean => {
  if (typeof haystack === 'string') {
    return haystack.includes(String(needle));
  }
  if (Array.isArray(haystack)) {
    return haystack.includes(needle);
  }
  if (haystack !== null && typeof haystack === 'object') {
    return String(needle) in (haystack as Record<string, unknown>);
  }
  return false;
};

export const resolveCollection = (value: unknown): unknown[] | null => {
  if (Array.isArray(value)) {
    return value as unknown[];
  }
  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>);
  }
  return null;
};

export const resolveObjectEntries = (value: unknown): [string, unknown][] | null => {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>);
  }
  return null;
};

const isNumeric = (value: unknown): boolean =>
  typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)));

/**
 * How `<`, `>`, `<=` and `>=` order two values, as Twig does: numbers — and strings that are numbers — by their value;
 * a string against anything else as text, so ISO dates (`'2026-10-24' >= '2026-10-20'`) and names compare as written.
 * Negative, zero or positive; NaN — every comparison false — when one side is missing or neither is a number.
 */
export const order = (left: unknown, right: unknown): number => {
  if (left === null || left === undefined || right === null || right === undefined) {
    return Number.NaN;
  }

  if (isNumeric(left) && isNumeric(right)) {
    return Number(left) - Number(right);
  }

  if (typeof left === 'string' || typeof right === 'string') {
    const a = serializeValue(left);
    const b = serializeValue(right);

    return a < b ? -1 : a > b ? 1 : 0;
  }

  return Number(left) - Number(right);
};
