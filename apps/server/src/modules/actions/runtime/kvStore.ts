import { listIdProblem, parseList, rangeOf, withEntry } from './kvList';

import type { KvListEntry, KvListPut } from './kvList';
import type { ActionKvAdapter, ActionKvStore } from '../types';

/** How many times a list write reads again after losing a race, before it says the list is busy. */
const LIST_ATTEMPTS = 25;

const pause = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export type KvStoreConfig = {
  /**
   * Prefixed onto every key before it reaches the adapter. Defaults to `kv:`.
   *
   * The store a deployment hands over usually holds other things — a page cache, a session index — and a flow
   * writing `visits:home` must not be able to land on one of them.
   */
  prefix?: string;
};

/**
 * The `kv` tasks, over whatever a deployment gave them to write into.
 *
 * The adapter is transport: strings in, strings out. Everything a counter's BEHAVIOUR depends on is here, in one
 * place, for every deployment at once — which is the point of the split. Three rules:
 *
 * 1. **Values round-trip through JSON**, so a flow reads back what it wrote instead of its own `toString`. A value
 *    written by something else is answered as the string it is rather than failing.
 * 2. **A counter's TTL is set once, by whoever created it, and never extended.** A window refreshed on every hit
 *    never closes while traffic keeps arriving — which is a rate limit that stops limiting exactly when it is
 *    being leant on. The counter is the one that created it precisely when the increment returns its own amount,
 *    so this needs no conditional-expire support from the adapter and works the same on Redis, Memcached or a
 *    table.
 * 3. **Nothing is caught.** This is not a cache: a miss means the rate limit did not count and the idempotency key
 *    was not seen, so an adapter that cannot answer fails the run rather than being read as "no value".
 *
 * A list is one value, changed only by `swap`: read, change, write back if nobody wrote in between, and read again if
 * somebody did. Every adapter can do that much, so lists work on all of them without a command of their own. They
 * live under `list:` rather than beside the values, so no key a flow writes can be one.
 */
/** What every key is prefixed with unless the store was given another. */
export const DEFAULT_KV_PREFIX = 'kv:';

/** Where a list lives, after the prefix: its own segment, so a list and a value of the same name never meet. */
export const LIST_SEGMENT = 'list:';

export const createKvStore = (
  adapter: ActionKvAdapter,
  { prefix = DEFAULT_KV_PREFIX }: KvStoreConfig = {}
): ActionKvStore => {
  const prefixed = (key: string) => `${prefix}${key}`;
  const listKey = (list: string) => `${prefix}${LIST_SEGMENT}${list}`;

  /** Applies `change` to the list and writes it back unless somebody wrote first — then reads again. */
  const changeList = async (list: string, change: (entries: KvListEntry[]) => KvListEntry[] | undefined) => {
    const key = listKey(list);
    for (let attempt = 0; attempt < LIST_ATTEMPTS; attempt += 1) {
      const raw = await adapter.get(key);
      const next = change(parseList(raw));
      if (!next) {
        return false;
      }

      if (await adapter.swap(key, raw, JSON.stringify(next))) {
        return true;
      }

      // Spread out, so the writers that lost to the same one do not all come back at the same instant.
      await pause(Math.random() * Math.min(5 + attempt * 5, 50));
    }

    throw new Error(`The list "${list}" is being written by many at once — try again in a moment`);
  };

  return {
    get: async key => {
      const raw = await adapter.get(prefixed(key));
      if (raw === undefined) {
        return undefined;
      }

      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return raw;
      }
    },
    set: (key, value, ttlSeconds) => adapter.set(prefixed(key), JSON.stringify(value), ttlSeconds),
    delete: key => adapter.delete(prefixed(key)),
    increment: async (key, amount, ttlSeconds) => {
      const full = prefixed(key);
      const value = await adapter.increment(full, amount);
      // Exactly its own amount means this call created the counter — the only moment its lifetime is set.
      if (ttlSeconds !== undefined && value === amount) {
        await adapter.expire(full, ttlSeconds);
      }

      return value;
    },
    swap: (key, expected, next, ttlSeconds) =>
      adapter.swap(
        prefixed(key),
        expected === undefined ? undefined : JSON.stringify(expected),
        JSON.stringify(next),
        ttlSeconds
      ),
    listPut: async (list, entry, options = {}) => {
      const problem = listIdProblem(entry.id);
      if (problem) {
        throw new Error(problem);
      }

      if (!Number.isFinite(entry.score)) {
        throw new Error('A list entry’s score is a number');
      }

      let put: KvListPut = { stored: false, dropped: [] };
      await changeList(list, entries => {
        const next = withEntry(entries, entry, options);
        put = next ? { stored: true, dropped: next.dropped } : { stored: false, dropped: [] };

        return next?.kept;
      });

      return put;
    },
    listRange: async (list, range) => rangeOf(parseList(await adapter.get(listKey(list))), range),
    listRemove: (list, id) =>
      changeList(list, entries =>
        entries.some(entry => entry.id === id) ? entries.filter(entry => entry.id !== id) : undefined
      )
  };
};
