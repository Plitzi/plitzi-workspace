/** One entry of a list: what it is called, where it sorts, and what it carries. */
export type KvListEntry = { id: string; score: number; value: unknown };

export type KvListRange = {
  /** How many entries to skip first. 0 when absent. */
  offset?: number;
  /** How many to answer. All of them when absent. */
  limit?: number;
  /** `desc` — the highest score first — when absent. */
  order?: 'asc' | 'desc';
};

/**
 * The most a list holds. A list is one value of the store, read and written whole, so it is for what a page shows at
 * once — the latest twenty, a leaderboard, a gallery — not for a table.
 */
export const MAX_LIST_ENTRIES = 500;

/** Its largest size, as JSON: under the 64 KB a MySQL `TEXT` column stores, whatever the deployment's store is. */
export const MAX_LIST_BYTES = 60_000;

const ID = /^[A-Za-z0-9:_.@-]{1,128}$/;

export const listIdProblem = (id: unknown): string | undefined =>
  typeof id === 'string' && ID.test(id) ? undefined : 'A list entry’s id is 1-128 of A-Z a-z 0-9 : _ . @ -';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isEntry = (value: unknown): value is KvListEntry =>
  isRecord(value) && typeof value.id === 'string' && typeof value.score === 'number';

/** The entries a stored list holds — none for a key that holds nothing, or something that is not a list. */
export const parseList = (raw: string | undefined): KvListEntry[] => {
  if (raw === undefined) {
    return [];
  }

  try {
    const value: unknown = JSON.parse(raw);

    return Array.isArray(value) ? value.filter(isEntry) : [];
  } catch {
    return [];
  }
};

/** Highest score first; entries that tie keep a stable order, by id. */
const byScore = (a: KvListEntry, b: KvListEntry): number =>
  b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * The list with `entry` in it — replacing the one with its id — sorted and cut to the highest `keep`. Refused, with
 * what to do instead, when the result would be larger than a list may be.
 */
export const withEntry = (entries: KvListEntry[], entry: KvListEntry, keep = MAX_LIST_ENTRIES): KvListEntry[] => {
  const kept = [...entries.filter(existing => existing.id !== entry.id), entry]
    .sort(byScore)
    .slice(0, Math.min(keep, MAX_LIST_ENTRIES));
  const bytes = Buffer.byteLength(JSON.stringify(kept));
  if (bytes > MAX_LIST_BYTES) {
    throw new Error(
      `A list is at most ${MAX_LIST_BYTES} bytes and this one would be ${bytes}: keep fewer entries (\`keep\`), or ` +
        'store less in each one — an id and what a page shows, with the rest under its own key'
    );
  }

  return kept;
};

export const rangeOf = (entries: KvListEntry[], { offset = 0, limit, order = 'desc' }: KvListRange = {}) => {
  const ordered = order === 'asc' ? entries.toReversed() : entries;
  const start = Math.max(0, Math.floor(offset));

  return ordered.slice(start, limit === undefined ? undefined : start + Math.max(0, Math.floor(limit)));
};
