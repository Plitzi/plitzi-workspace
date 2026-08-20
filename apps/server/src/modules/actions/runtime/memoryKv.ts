import type { ActionKvAdapter } from '../types';

type Entry = { value: string; expiresAt?: number };

/**
 * The `kv` tasks' fallback store: in this process, and nowhere else.
 *
 * Real enough for a single replica and for local work, and deliberately not pretending otherwise — a deployment
 * running several replicas passes an adapter over something shared, because a counter that only counts its own
 * replica is a rate limit that multiplies by the number of them.
 *
 * An adapter like any other: it stores strings and obeys no rules of its own. What a counter DOES lives in
 * `createKvStore`, so the in-process store and a deployment's own behave identically rather than nearly so.
 */
export const createMemoryKv = (): ActionKvAdapter => {
  const entries = new Map<string, Entry>();

  const read = (key: string): Entry | undefined => {
    const entry = entries.get(key);
    if (!entry) {
      return undefined;
    }

    // Expiry is the store's own job everywhere else — Redis answers nothing for a key past its TTL — so this one
    // has to do it too, or the same code reads a stale counter here and an absent one in production.
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
    increment: (key, amount) => {
      const current = read(key);
      const base = Number(current?.value ?? 0);
      const next = (Number.isFinite(base) ? base : 0) + amount;
      entries.set(key, { value: String(next), expiresAt: current?.expiresAt });

      return Promise.resolve(next);
    },
    expire: (key, ttlSeconds) => {
      const current = read(key);
      if (current) {
        entries.set(key, { ...current, expiresAt: expiry(ttlSeconds) });
      }

      return Promise.resolve();
    }
  };
};
