import type { ActionKvAdapter } from '@plitzi/sdk-server/actions';

/**
 * The store seam, written out in full — because it is the one that degrades in SILENCE.
 *
 * Without it the module keeps its own Map, which is honest for one process and a no-op for a cluster: two
 * replicas each think they are the only run in flight, so single-flight stops being single, a cancel never
 * reaches the replica running the flow, and a redelivery runs the work twice. Nothing errors. The symptom is a
 * customer charged twice on a Tuesday.
 *
 * Five operations over strings, and no rule to obey — everything that decides how a counter behaves lives above
 * this. Against Redis they are one command each, which is the whole reason the seam is this shape:
 *
 * | here        | Redis                 |
 * |-------------|-----------------------|
 * | `get`       | `GET key`             |
 * | `set`       | `SET key value EX s`  |
 * | `delete`    | `DEL key`             |
 * | `increment` | `INCRBY key amount`   |
 * | `expire`    | `EXPIRE key s`        |
 *
 * This one is a Map with real expiry so the example runs with nothing installed. Yours is the client you already
 * have; what matters is that `increment` is ATOMIC — it is the test-and-set the single-flight key is taken with,
 * and a get-then-set version of it is a race that hands the same key to two replicas.
 */
const entries = new Map<string, { value: string; expiresAt?: number }>();

const live = (key: string): { value: string; expiresAt?: number } | undefined => {
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

export const exampleKv: ActionKvAdapter = {
  get: key => Promise.resolve(live(key)?.value),
  set: (key, value, ttlSeconds) => {
    entries.set(key, { value, ...(ttlSeconds === undefined ? {} : { expiresAt: Date.now() + ttlSeconds * 1000 }) });

    return Promise.resolve();
  },
  delete: key => {
    entries.delete(key);

    return Promise.resolve();
  },
  increment: (key, amount) => {
    const current = Number(live(key)?.value ?? '0');
    const next = current + amount;
    // The expiry is NOT reset here: a rate-limit window that renewed itself on every hit would never close.
    entries.set(key, { value: String(next), ...(live(key)?.expiresAt ? { expiresAt: live(key)?.expiresAt } : {}) });

    return Promise.resolve(next);
  },
  expire: (key, ttlSeconds) => {
    const entry = live(key);
    if (entry) {
      entries.set(key, { ...entry, expiresAt: Date.now() + ttlSeconds * 1000 });
    }

    return Promise.resolve();
  }
};
