/**
 * Whether a value counts as true, when it may have travelled as text — the reading every condition a binding asks
 * shares: `not` inverts it, and a binding to `visibility` is it.
 *
 * A binding's value reaches here from wherever the data came from — a server task's boolean, a Twig token, a query
 * string — and by the time it arrives the boolean may be the STRING `"false"`, which JavaScript calls true. Reading
 * it as truthy is the whole bug: the element the author asked to hide appears, and nothing reports anything.
 *
 * An empty array is false because that is what an author means by it: `records` with nothing in it is a list with
 * nothing to show. An empty object is NOT — a data source answers `{}` for "no record", but it also answers `{}`
 * for a record with no fields, and guessing between them is not a condition's decision.
 */
const FALSE_TOKENS = new Set(['false', '0', '']);

export const isTrue = (value: unknown): boolean => {
  if (typeof value === 'string') {
    return !FALSE_TOKENS.has(value.trim().toLowerCase());
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return Boolean(value);
};
