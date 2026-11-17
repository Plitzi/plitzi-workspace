// The kernel takes no value from another Plitzi package (docs/en/server-packages.md, D3): sdk-shared's `isRecord`,
// written once for the kernel.
/** A plain object, read field by field: not null, not an array. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
