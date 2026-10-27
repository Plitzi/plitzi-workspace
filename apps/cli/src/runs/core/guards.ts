/** The plain checks every file the run reads is held to: what a value must be, said once for all of them. */

export const isString = (value: unknown): value is string => typeof value === 'string';

export const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);

/** A file's fingerprint, or `null` for one that is not there. */
export const isDigest = (value: unknown): value is string | null => value === null || isString(value);

export const oneOf =
  <T extends string>(values: readonly T[]) =>
  (value: unknown): value is T =>
    typeof value === 'string' && (values as readonly string[]).includes(value);

/** Left out, or as `guard` says. */
export const optional = (value: unknown, guard: (inner: unknown) => boolean): boolean =>
  value === undefined || guard(value);

/** A web site's address: `http(s)://` and a host — what a browser opens. */
export const isSiteAddress = (value: unknown): value is string => {
  if (!isString(value)) {
    return false;
  }

  try {
    const url = new URL(value);

    return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname !== '';
  } catch {
    return false;
  }
};
