/** A plain object — what JSON gives back — and nothing with a prototype of its own (a Date, a Map, a class instance). */
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype: unknown = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
};

/**
 * `next`, with every part of it equal to the same part of `previous` replaced by that part of `previous` — `previous`
 * itself when the two are equal all through.
 *
 * A provider answers a new object every time it is asked, the same data or not: a refresh, a loading flag flipping,
 * the answer published again. Whatever is drawn from it — a list's rows, an element bound to one field — was drawn
 * again for each, though nothing it shows had changed (the dashboard's list of spaces drew every card thirteen times
 * as the page loaded). With what did not change kept as it was, a reader that compares by identity draws only what did.
 *
 * Plain objects and arrays are compared field by field; anything else (a Date, a Map, a function) by identity.
 */
export const replaceEqualDeep = <T>(previous: unknown, next: T): T => {
  if (Object.is(previous, next)) {
    return next;
  }

  if (Array.isArray(previous) && Array.isArray(next)) {
    let same = previous.length === next.length;
    let reused = false;
    const merged: unknown[] = [];
    for (let index = 0; index < next.length; index++) {
      const kept: unknown = replaceEqualDeep(previous[index], next[index]);
      merged.push(kept);
      const isPrevious = index < previous.length && Object.is(kept, previous[index]);
      same &&= isPrevious;
      reused ||= !Object.is(kept, next[index]);
    }

    if (same) {
      // Equal to `next` all through, and so of its type.
      return previous as T;
    }

    // Nothing of `previous` kept: `next` as it came, rather than a copy of it.
    return (reused ? merged : next) as T;
  }

  if (isPlainObject(previous) && isPlainObject(next)) {
    const keys = Object.keys(next);
    let same = keys.length === Object.keys(previous).length;
    let reused = false;
    const merged: Record<string, unknown> = {};
    for (const key of keys) {
      const kept: unknown = replaceEqualDeep(previous[key], next[key]);
      merged[key] = kept;
      const isPrevious = Object.hasOwn(previous, key) && Object.is(kept, previous[key]);
      same &&= isPrevious;
      reused ||= !Object.is(kept, next[key]);
    }

    if (same) {
      // Equal to `next` all through, and so of its type.
      return previous as T;
    }

    // Built from `next`'s own keys and values, the equal ones taken from `previous`: the same shape as `next`.
    return (reused ? merged : next) as T;
  }

  return next;
};
