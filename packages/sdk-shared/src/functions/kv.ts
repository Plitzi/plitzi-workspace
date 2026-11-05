import type { KvChangeLifetime } from './kvChange';

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
 * The `kv` tasks' own view: values rather than strings, and a TTL that means what a caller expects.
 *
 * Built by `createKvStore` over an {@link ActionKvAdapter}, and then narrowed to one space by `namespaceKv`. A
 * task never sees an adapter.
 */
export type ActionKvStore = {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown, ttlSeconds?: number) => Promise<void>;
  delete: (key: string) => Promise<void>;
  increment: (key: string, amount: number, ttlSeconds?: number) => Promise<number>;
  /**
   * Writes `next` only if the key still holds `expected` — the value `get` answered — or, with `expected` undefined,
   * only if it holds nothing. Answers whether it wrote: read, change, and write back with this, and a writer that
   * lost the race is told so instead of undoing the other.
   */
  swap: (key: string, expected: unknown, next: unknown, ttlSeconds?: number) => Promise<boolean>;
  /**
   * Puts `entry` in the list — replacing the one with its id — keeping the highest `keep` by score, and answers what
   * that dropped, for whatever it named to be let go of too. A list has no lifetime: it lives until its entries are
   * removed.
   */
  listPut: (list: string, entry: KvListEntry, options?: KvListPutOptions) => Promise<KvListPut>;
  listRange: (list: string, range?: KvListRange) => Promise<KvListEntry[]>;
  /** Takes the entry with `id` out of the list, and answers whether it was there. */
  listRemove: (list: string, id: string) => Promise<boolean>;
  /**
   * Writes the list's entry `id` as `next` — or takes it out, `next` null — only if it is still `expected`, the entry
   * `listRange` answered (or, `expected` undefined, only if there is none). Answers whether it wrote: `swap`, for one
   * entry of a list.
   */
  listSwap: (list: string, id: string, expected: KvListEntry | undefined, next: KvListEntry | null) => Promise<boolean>;
  /**
   * Reads the list's entry `id`, hands it to `change` and writes back what that answers — `{ score, value }`, or `null`
   * to take it out — reading and asking again when somebody wrote in between. `undefined` writes nothing. A vote that
   * re-scores an entry while the track it is starts was the race (a run's queue): the entry gone, nothing is put back.
   */
  listChange: (
    list: string,
    id: string,
    change: (
      current: KvListEntry | undefined
    ) =>
      | { score: number; value: unknown }
      | null
      | undefined
      | Promise<{ score: number; value: unknown } | null | undefined>
  ) => Promise<KvListEntry | null | undefined>;
  /**
   * Reads the key, hands its value to `change` and writes back what that answers — reading and asking again when
   * somebody wrote in between, so no writer undoes another. `change` answering `undefined` writes nothing. Answers what
   * was written. `lifetime` is seconds, or worked out from the value written.
   */
  change: <T>(
    key: string,
    change: (current: unknown) => T | undefined | Promise<T | undefined>,
    lifetime?: KvChangeLifetime<T>
  ) => Promise<T | undefined>;
};
