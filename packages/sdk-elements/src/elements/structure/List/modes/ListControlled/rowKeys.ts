import { get } from '@plitzi/plitzi-ui/helpers';

/** The field of every record that names it, when each has one and no two share it. */
const keysBy = (items: unknown[], field: string): string[] | undefined => {
  const keys = items.map(item => {
    const value: unknown = get(item, field);

    return typeof value === 'string' || typeof value === 'number' ? `${field}:${String(value)}` : undefined;
  });
  if (!keys.every(key => key !== undefined) || new Set(keys).size !== keys.length) {
    return undefined;
  }

  return keys;
};

/**
 * What tells one row from another across renders: the record's `itemKey` field when the list names one, else its
 * `id` — when every record has one and no two share it — else its position.
 *
 * A row holds state of its own — a panel it opened, a field it filled, an animation it played on arrival — and React
 * gives that state to whichever row comes back under the same key. Keyed by position, filtering a list handed a row's
 * state to the record that moved into its place, and a one-row list showing "the current slide" never mounted again,
 * so its entrance never replayed.
 */
export const rowKeys = (items: unknown[], itemKey?: string): (string | number)[] =>
  (itemKey ? keysBy(items, itemKey) : undefined) ?? keysBy(items, 'id') ?? items.map((_item, index) => index);
