import type { ActionKvStore } from '../types';

type Entry = { value: unknown; expiresAt?: number };

/**
 * The `kv` tasks' fallback store: in this process, and nowhere else.
 *
 * Real enough for a single replica and for local work, and deliberately not pretending otherwise — a deployment
 * running several replicas passes a Redis-backed store, because a counter that only counts its own replica is a
 * rate limit that multiplies by the number of them.
 */
export const createMemoryKv = (): ActionKvStore => {
  const entries = new Map<string, Entry>();

  const read = (key: string): Entry | undefined => {
    const entry = entries.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      entries.delete(key);

      return undefined;
    }

    return entry;
  };

  const expiry = (ttlSeconds?: number) => (ttlSeconds === undefined ? undefined : Date.now() + ttlSeconds * 1000);

  return {
    get: key => Promise.resolve(read(key)?.value),
    set: (key, value, ttlSeconds) => {
      entries.set(key, { value, expiresAt: expiry(ttlSeconds) });

      return Promise.resolve();
    },
    delete: key => {
      entries.delete(key);

      return Promise.resolve();
    },
    increment: (key, amount, ttlSeconds) => {
      const current = read(key);
      const base = typeof current?.value === 'number' ? current.value : 0;
      const next = base + amount;
      // The TTL is set by whoever creates the counter and is NOT extended by later increments: a rate-limit window
      // that slides forward on every hit never ends, which is the opposite of what a window is for.
      entries.set(key, { value: next, expiresAt: current?.expiresAt ?? expiry(ttlSeconds) });

      return Promise.resolve(next);
    }
  };
};
