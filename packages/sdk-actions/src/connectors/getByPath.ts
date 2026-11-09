/**
 * Reads a dot path out of an arbitrary JSON response (`data.items`, `meta.pagination.total`). Kept local and
 * dependency-free on purpose: the equivalent helper in plitzi-ui would drag the UI bundle into the request path.
 *
 * A path of `.` or an empty path returns the value itself, which is how a manifest says "the response *is* the
 * array" or "the record *is* its own values".
 */
export const getByPath = (source: unknown, path?: string): unknown => {
  if (!path || path === '.') {
    return source;
  }

  return path.split('.').reduce<unknown>((current, key) => {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (Array.isArray(current)) {
      const index = Number(key);

      return Number.isInteger(index) ? current[index] : undefined;
    }

    if (typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }

    return undefined;
  }, source);
};
