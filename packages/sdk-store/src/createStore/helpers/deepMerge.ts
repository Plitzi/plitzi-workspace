export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Deep merge that overlays `override` onto `base` while preserving references for untouched subtrees, so the
// scope chain can combine values at any depth (e.g. parent's `runtime.sources.variables` + child's
// `runtime.sources.record`) without one clobbering the other.
export const deepMerge = (base: unknown, override: unknown): unknown => {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override;
  }

  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    result[key] = key in base ? deepMerge(base[key], override[key]) : override[key];
  }

  return result;
};
