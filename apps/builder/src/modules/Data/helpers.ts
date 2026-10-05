/**
 * The space's own data, as its panel edits it: JSON files a provider of the space reads on the server — `query:
 * '/data/<file>'` with `runtime: 'server'` — never served.
 */

/** What a space with no data starts from: one file, a list, to change rather than a blank page. */
export const STARTER_FILES: Record<string, string> = {
  'items.json': '[\n  { "id": 1, "name": "First" },\n  { "id": 2, "name": "Second" }\n]\n'
};

/** A new file's name as typed, made a data file's: trimmed, and a `.json` one when it says nothing else. */
export const dataFileName = (typed: string): string => {
  const name = typed.trim();

  return !name || name.endsWith('.json') ? name : `${name}.json`;
};

/** What is wrong with a file's text as JSON, as the parser says it — or nothing, when it reads. */
export const jsonProblemOf = (text: string): string | undefined => {
  try {
    JSON.parse(text);

    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

/** The query a provider reads a file by. */
export const queryOf = (file: string): string => `/data/${file}`;
