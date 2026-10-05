import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { ActionKvAdapter } from '../actions/types';

export type SqliteKvOptions = (
  | {
      /** The database file — created, with its folder, when it is not there. Opened in WAL mode. */
      file: string;
      db?: never;
    }
  | {
      /** A database the deployment opened and shares with its own tables (a job queue, an activity log). */
      db: DatabaseSync;
      file?: never;
    }
) & {
  /** The table the keys live in, created when it is not there. Default `action_kv`. */
  table?: string;
};

/**
 * The STORE's clock in epoch ms, read inside each statement: every process on the file agrees on what "now" is.
 * `julianday()` with no argument is the current instant.
 */
const NOW_MS = 'CAST((julianday() - 2440587.5) * 86400000 AS INTEGER)';

const open = (file: string): DatabaseSync => {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new DatabaseSync(file);
  // WAL so a reader never blocks a writer; `busy_timeout` so two processes reaching for the write lock at once queue
  // for it instead of one of them failing with SQLITE_BUSY.
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;');

  return db;
};

/**
 * A key/value store in a SQLite file, over Node's own `node:sqlite` — nothing to install, nothing to run beside the
 * server. For a deployment with no database that wants what `kv` keeps to survive a restart AND to be shared: every
 * process pointed at the same file — replicas on one machine, a server started with `workers` — sees the same keys,
 * the same counters and the same single-flight keys.
 *
 * ```ts
 * import { createSqliteKv } from '@plitzi/sdk-server/sqlite';
 *
 * createServer({ action: { kv: createSqliteKv({ file: 'data/kv.sqlite' }) } });
 * ```
 *
 * Every operation is ONE statement, so it is atomic without a transaction: an increment is an upsert that adds in
 * place, a swap is an update whose `WHERE` names the value it expects. Lifetimes are instants on the store's clock,
 * enforced on every read, and expired rows are swept as writes go by.
 *
 * Needs a Node with `node:sqlite` unflagged (22.13 and later), which still prints an `ExperimentalWarning` once when
 * it loads — the reason this is its own entry rather than the default.
 */
export const createSqliteKv = (options: SqliteKvOptions): ActionKvAdapter => {
  const table = options.table ?? 'action_kv';
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) {
    throw new Error(
      `createSqliteKv: "${table}" is not a table name (letters, digits and _, not starting with a digit).`
    );
  }

  const db = options.db ?? open(options.file);
  db.exec(`CREATE TABLE IF NOT EXISTS ${table} (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires_at INTEGER)`);

  const live = `(expires_at IS NULL OR expires_at > ${NOW_MS})`;
  const expiry = (ttlSeconds?: number) => (ttlSeconds === undefined ? null : ttlSeconds * 1000);
  const expiresAt = `CASE WHEN ? IS NULL THEN NULL ELSE ${NOW_MS} + ? END`;

  const statements = {
    get: db.prepare(`SELECT value FROM ${table} WHERE key = ? AND ${live}`),
    set: db.prepare(
      `INSERT INTO ${table} (key, value, expires_at) VALUES (?, ?, ${expiresAt})
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at`
    ),
    delete: db.prepare(`DELETE FROM ${table} WHERE key = ?`),
    // A counter whose window has run out starts again from `amount` rather than adding to a dead value, and its
    // lifetime is never renewed here — a rate-limit window that stretched on every hit would never close.
    increment: db.prepare(
      `INSERT INTO ${table} (key, value, expires_at) VALUES (?, ?, NULL)
       ON CONFLICT (key) DO UPDATE SET
         value = CASE WHEN ${table}.expires_at IS NOT NULL AND ${table}.expires_at <= ${NOW_MS}
           THEN excluded.value ELSE CAST(${table}.value + ? AS TEXT) END,
         expires_at = CASE WHEN ${table}.expires_at IS NOT NULL AND ${table}.expires_at <= ${NOW_MS}
           THEN NULL ELSE ${table}.expires_at END
       RETURNING value`
    ),
    expire: db.prepare(`UPDATE ${table} SET expires_at = ${expiresAt} WHERE key = ? AND ${live}`),
    // Expecting nothing: the insert takes a free key, and over a taken one updates only a row whose lifetime has run
    // out — a live row is left as it is, and no row changed is the refusal.
    claim: db.prepare(
      `INSERT INTO ${table} (key, value, expires_at) VALUES (?, ?, ${expiresAt})
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at
       WHERE ${table}.expires_at IS NOT NULL AND ${table}.expires_at <= ${NOW_MS}`
    ),
    replace: db.prepare(
      `UPDATE ${table} SET value = ?, expires_at = ${expiresAt} WHERE key = ? AND value = ? AND ${live}`
    ),
    sweep: db.prepare(`DELETE FROM ${table} WHERE expires_at IS NOT NULL AND expires_at <= ${NOW_MS}`)
  };

  /** Used-once keys (a delivery's idempotency key, a caller's window) expire and stay until swept: once a minute. */
  let sweptAt = 0;
  const sweep = () => {
    if (Date.now() - sweptAt < 60_000) {
      return;
    }

    sweptAt = Date.now();
    statements.sweep.run();
  };

  const text = (row: Record<string, unknown> | undefined): string | undefined =>
    typeof row?.value === 'string' ? row.value : undefined;

  return {
    get: key => Promise.resolve(text(statements.get.get(key))),
    set: (key, value, ttlSeconds) => {
      statements.set.run(key, value, expiry(ttlSeconds), expiry(ttlSeconds));
      sweep();

      return Promise.resolve();
    },
    delete: key => {
      statements.delete.run(key);

      return Promise.resolve();
    },
    increment: (key, amount) => {
      // A JS number binds as a REAL, and `'20' + 2.0` is `22.0`: a whole amount goes as an INTEGER, so the counter
      // reads `22` as every other store's does.
      const step = Number.isInteger(amount) ? BigInt(amount) : amount;
      const value = text(statements.increment.get(key, String(amount), step));
      sweep();

      return Promise.resolve(Number(value ?? amount));
    },
    expire: (key, ttlSeconds) => {
      statements.expire.run(expiry(ttlSeconds), expiry(ttlSeconds), key);

      return Promise.resolve();
    },
    swap: (key, expected, next, ttlSeconds) => {
      const written =
        expected === undefined
          ? statements.claim.run(key, next, expiry(ttlSeconds), expiry(ttlSeconds))
          : statements.replace.run(next, expiry(ttlSeconds), expiry(ttlSeconds), key, expected);
      sweep();

      return Promise.resolve(written.changes === 1);
    }
  };
};
