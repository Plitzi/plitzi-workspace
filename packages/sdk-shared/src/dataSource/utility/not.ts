import type { DataSourceUtility } from '../../types';

/**
 * What counts as false, when the value may have travelled as text.
 *
 * A binding's value reaches here from wherever the data came from — a server task's boolean, a Twig token, a query
 * string — and by the time it arrives the boolean may be the STRING `"false"`, which JavaScript calls true. Reading
 * it as truthy is the whole bug: the element the author asked to hide appears, and nothing reports anything.
 *
 * An empty array is false because that is what an author means by it: `records` with nothing in it is a list with
 * nothing to show. An empty object is NOT — a data source answers `{}` for "no record", but it also answers `{}`
 * for a record with no fields, and guessing between them is not this transformer's decision.
 */
const FALSE_TOKENS = new Set(['false', '0', '']);

const isTrue = (value: unknown): boolean => {
  if (typeof value === 'string') {
    return !FALSE_TOKENS.has(value.trim().toLowerCase());
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return Boolean(value);
};

/**
 * The inverse of the value, as a boolean.
 *
 * A binding shows an element when its field is true and there is no "unless", so without this every condition a
 * page reads has to arrive from the server in both polarities — `found` AND `missing`, `signedIn` AND `signedOut`.
 * That is a field per question that exists only because the client could not say "not", and it puts the answer to
 * "when is this hidden?" in a different repository from the page that hides it.
 */
const not: DataSourceUtility<unknown, boolean> = {
  action: 'not',
  title: 'Not',
  type: 'utility',
  params: {},
  preview: { content: '' },
  callback: (source: unknown) => !isTrue(source)
};

export default not;
