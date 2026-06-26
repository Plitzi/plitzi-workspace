// Shallow key omit: one pass over own enumerable keys, a single allocation. The shared `omit` from plitzi-ui is
// path-aware (it runs `toPath` + `has` + a clone-at-path per key), which is overkill for the per-element render hot
// path where only top-level keys are ever removed — there it clones the source object once per key.
export const omitKeys = <T extends object>(obj: T, keys: readonly string[]): Partial<T> => {
  const skip = new Set<string>(keys);
  const result: Record<string, unknown> = {};
  for (const key in obj) {
    if (!skip.has(key) && Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = (obj as Record<string, unknown>)[key];
    }
  }

  return result as Partial<T>;
};
