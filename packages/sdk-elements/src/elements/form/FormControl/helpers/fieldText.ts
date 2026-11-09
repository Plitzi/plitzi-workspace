/**
 * A field's value as the text it shows and its rules read: a number bound to it — a count, a price from a provider —
 * as its digits. Read as text alone, a bound `1` drew an empty field over the count it was meant to change.
 */
export const fieldText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
};
