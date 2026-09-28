import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { SQLOutputValue } from 'node:sqlite';

/**
 * The one store this deployment runs: a SQLite file.
 *
 * Every piece of state the scheduler needs to survive lives here — the jobs, the schedules, the key/value store the
 * run guards take their single-flight keys in, and the activity the page shows. So stopping the process loses
 * nothing, and a second process pointed at the same file is a second replica rather than a second copy.
 *
 * SQLite because it needs nothing installed and still keeps both promises a queue owes: a write survives a crash,
 * and two processes cannot take the same row. That second one is `BEGIN IMMEDIATE` — see {@link transaction}.
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  space_id INTEGER NOT NULL,
  action_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  input TEXT NOT NULL,
  due_at INTEGER NOT NULL,
  max_attempts INTEGER NOT NULL,
  missed INTEGER,
  status TEXT NOT NULL,
  run_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_until INTEGER,
  worker_id TEXT,
  run_id TEXT,
  cancel_requested INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  error TEXT,
  history TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS jobs_claimable ON jobs (status, run_at);
CREATE INDEX IF NOT EXISTS jobs_by_space ON jobs (space_id, updated_at);

CREATE TABLE IF NOT EXISTS schedules (
  space_id INTEGER NOT NULL,
  action_id TEXT NOT NULL,
  cron TEXT NOT NULL,
  timezone TEXT,
  environment TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  next_run_at INTEGER NOT NULL,
  last_fire_at INTEGER,
  missed INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (space_id, action_id)
);

CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at INTEGER
);

CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  replica TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  message TEXT NOT NULL
);
`;

export const openDatabase = (file: string): DatabaseSync => {
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  /**
   * WAL so a replica reading the board never blocks one claiming a job; `busy_timeout` so two replicas that reach
   * for the write lock at the same instant queue for it instead of one of them failing with SQLITE_BUSY.
   */
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;');
  db.exec(SCHEMA);

  return db;
};

/**
 * The store's clock, in epoch ms — the only clock the queue reads.
 *
 * SQLite has no server, so this is the clock of the machine the file sits on. That is exactly right for SQLite,
 * whose file is only ever shared by processes on ONE machine: they all read the same clock through it. A queue
 * spread across machines needs a store with a clock of its own — Mongo's `hello().localTime`, Postgres's `now()` —
 * and the adapter reads that one instead. What matters is that nothing in the queue asks `Date.now()`.
 */
export const storeNow = (db: DatabaseSync): number =>
  integer(db.prepare("SELECT CAST(unixepoch('subsec') * 1000 AS INTEGER) AS now").get() ?? {}, 'now');

/**
 * Runs `work` holding the database's write lock from the first statement.
 *
 * `IMMEDIATE` rather than the default `DEFERRED`: a deferred transaction reads first and asks for the lock only when
 * it writes, so two replicas can both read the same pending job and both go on to claim it. Taking the lock up
 * front is what makes "read the due jobs, mark them mine" one step as far as every other process is concerned.
 */
export const transaction = <T>(db: DatabaseSync, work: () => T): T => {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    db.exec('COMMIT');

    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
};

export type Row = Record<string, SQLOutputValue>;

/** A column that must be a number. SQLite answers integers as `number` unless asked for bigints, which nothing here does. */
export const integer = (row: Row, column: string): number => {
  const value = row[column];
  if (typeof value === 'number') {
    return value;
  }

  throw new Error(`Expected column "${column}" to be a number, got ${typeof value}`);
};

/** A column that may be NULL — or not selected at all, which an index into a `Record` does not admit to. */
const absent = (row: Row, column: string): boolean => !Object.hasOwn(row, column) || row[column] === null;

export const optionalInteger = (row: Row, column: string): number | undefined =>
  absent(row, column) ? undefined : integer(row, column);

export const text = (row: Row, column: string): string => {
  const value = row[column];
  if (typeof value === 'string') {
    return value;
  }

  throw new Error(`Expected column "${column}" to be text, got ${typeof value}`);
};

export const optionalText = (row: Row, column: string): string | undefined =>
  absent(row, column) ? undefined : text(row, column);

/** `IN (?, ?, …)` for a list of ids, which SQLite has no array binding for. */
export const placeholders = (values: readonly unknown[]): string => values.map(() => '?').join(', ');
