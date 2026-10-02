/** A plain object read off untyped data — JSON, a message, a document — and not an array, which is an object too. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
