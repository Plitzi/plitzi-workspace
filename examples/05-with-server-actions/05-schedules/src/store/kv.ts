import { optionalText, storeNow, text } from './database.ts';

import type { ActionKvAdapter } from '@plitzi/sdk-server/actions';
import type { DatabaseSync } from 'node:sqlite';

/**
 * The `kv` seam over the same file as the queue.
 *
 * It is not optional once there is a second replica. A worker takes a job's single-flight key here before it runs
 * the flow, keyed by the JOB's id — so a replica that merely stalled (lease lapsed, job handed to another replica)
 * and then wakes up is refused as a duplicate instead of running the same export alongside its replacement. With
 * the default in-process Map each replica would hold its own keys, and that refusal would never happen.
 *
 * Expiry is read against the store's clock, for the same reason the queue's instants are.
 */
export const createSqliteKv = (db: DatabaseSync): ActionKvAdapter => {
  const expiresAt = (ttlSeconds?: number) => (ttlSeconds === undefined ? null : storeNow(db) + ttlSeconds * 1000);

  return {
    get: key => {
      const row = db
        .prepare('SELECT value FROM kv WHERE key = ? AND (expires_at IS NULL OR expires_at > ?)')
        .get(key, storeNow(db));

      return Promise.resolve(row ? optionalText(row, 'value') : undefined);
    },
    set: (key, value, ttlSeconds) => {
      db.prepare('INSERT OR REPLACE INTO kv (key, value, expires_at) VALUES (?, ?, ?)').run(
        key,
        value,
        expiresAt(ttlSeconds)
      );

      return Promise.resolve();
    },
    delete: key => {
      db.prepare('DELETE FROM kv WHERE key = ?').run(key);

      return Promise.resolve();
    },
    /**
     * One statement, so it is atomic without a transaction: this is the test-and-set the single-flight key is taken
     * with. A counter whose window has run out starts again from `amount` rather than adding to a dead value, and
     * its expiry is never renewed here — a rate-limit window that stretched on every hit would never close.
     */
    increment: (key, amount) => {
      const at = storeNow(db);
      const row = db
        .prepare(
          `INSERT INTO kv (key, value, expires_at) VALUES (?, ?, NULL)
           ON CONFLICT (key) DO UPDATE SET
             value = CASE WHEN kv.expires_at IS NOT NULL AND kv.expires_at <= ? THEN excluded.value ELSE CAST(kv.value + ? AS TEXT) END,
             expires_at = CASE WHEN kv.expires_at IS NOT NULL AND kv.expires_at <= ? THEN NULL ELSE kv.expires_at END
           RETURNING value`
        )
        .get(key, String(amount), at, amount, at);

      return Promise.resolve(row ? Number(text(row, 'value')) : amount);
    },
    expire: (key, ttlSeconds) => {
      db.prepare('UPDATE kv SET expires_at = ? WHERE key = ?').run(expiresAt(ttlSeconds), key);

      return Promise.resolve();
    }
  };
};
