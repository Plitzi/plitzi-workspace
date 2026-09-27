/**
 * A query's `input`, as the server reads a page's query params: flat, each value a string. An object as authored, or
 * its JSON text as the editor keeps it; anything else is no input at all.
 */
export const queryInputOf = (input: unknown): Record<string, string> | undefined => {
  let value = input;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value || '{}');
    } catch {
      return undefined;
    }
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) =>
      typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean' ? [[key, String(entry)]] : []
    )
  );
};
