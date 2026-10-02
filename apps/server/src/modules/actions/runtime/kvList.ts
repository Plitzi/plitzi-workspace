import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';
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

/**
 * Its largest size, as JSON. Every store holds far more; this is what a list is read and written whole for — a page's
 * worth of entries, each an id and what the page shows — and past it, a list is being used as a table.
 */
export const MAX_LIST_BYTES = 128_000;

const ID = /^[A-Za-z0-9:_.@-]{1,128}$/;

export const listIdProblem = (id: unknown): string | undefined =>
  typeof id === 'string' && ID.test(id) ? undefined : 'A list entry’s id is 1-128 of A-Z a-z 0-9 : _ . @ -';

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

export type KvListPutOptions = {
  /** How many to keep, the highest scores; what falls past it is dropped. {@link MAX_LIST_ENTRIES} at most. */
  keep?: number;
  /**
   * Replace an entry already there only with a score at least as high — a player's best, or the latest of two writes
   * that arrived out of order. Otherwise the one there stays and nothing is written.
   */
  higherOnly?: boolean;
};

/** What a put did: whether the entry went in, and what `keep` dropped to make room. */
export type KvListPut = { stored: boolean; dropped: KvListEntry[] };

/**
 * The list with `entry` in it — replacing the one with its id — sorted and cut to the highest `keep`, and what the cut
 * dropped; `undefined` when `higherOnly` keeps the one there. Refused, with what to do instead, when the result would
 * be larger than a list may be.
 */
export const withEntry = (
  entries: KvListEntry[],
  entry: KvListEntry,
  { keep = MAX_LIST_ENTRIES, higherOnly = false }: KvListPutOptions = {}
): { kept: KvListEntry[]; dropped: KvListEntry[] } | undefined => {
  const there = entries.find(existing => existing.id === entry.id);
  if (higherOnly && there && there.score > entry.score) {
    return undefined;
  }

  const sorted = [...entries.filter(existing => existing.id !== entry.id), entry].sort(byScore);
  const cut = Math.min(Math.max(0, Math.floor(keep)), MAX_LIST_ENTRIES);
  const kept = sorted.slice(0, cut);
  const bytes = Buffer.byteLength(JSON.stringify(kept));
  if (bytes > MAX_LIST_BYTES) {
    throw new Error(
      `A list is at most ${MAX_LIST_BYTES} bytes and this one would be ${bytes}: keep fewer entries (\`keep\`), or ` +
        'store less in each one — an id and what a page shows, with the rest under its own key'
    );
  }

  return { kept, dropped: sorted.slice(cut) };
};

export const rangeOf = (entries: KvListEntry[], { offset = 0, limit, order = 'desc' }: KvListRange = {}) => {
  const ordered = order === 'asc' ? entries.toReversed() : entries;
  const start = Math.max(0, Math.floor(offset));

  return ordered.slice(start, limit === undefined ? undefined : start + Math.max(0, Math.floor(limit)));
};
