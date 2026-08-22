import type { ActionKvAdapter, ActionKvStore } from '../types';

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
 */
export const createKvStore = (adapter: ActionKvAdapter, { prefix = 'kv:' }: KvStoreConfig = {}): ActionKvStore => {
  const prefixed = (key: string) => `${prefix}${key}`;

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
    }
  };
};
