export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Overlays `override` onto `base`, recursing into plain objects so the scope chain can combine values at any depth
// without one side clobbering the other. Untouched subtrees keep their reference.
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
