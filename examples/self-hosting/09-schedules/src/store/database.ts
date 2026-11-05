import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { SQLOutputValue } from 'node:sqlite';

/**
 * The one store this deployment runs: a SQLite file.
 *
 * Every piece of state the scheduler needs to survive lives here — the jobs and the schedules (`createSqliteJobQueue`),
 * the key/value store the run guards take their single-flight keys in (`createSqliteKv`), and the activity the page
 * shows (below). So stopping the process loses nothing, and a second process pointed at the same file is a second
 * replica rather than a second copy.
 *
 * SQLite because it needs nothing installed and still keeps both promises a queue owes: a write survives a crash, and
 * two processes cannot take the same job — the SDK's queue holds the file's write lock (`BEGIN IMMEDIATE`) a call.
 */

const SCHEMA = `
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
 * The store's clock, in epoch ms: what the activity feed is stamped with. SQLite has no server, so it is the clock of
 * the machine the file sits on — the one every replica on that machine reads, as the queue does.
 */
export const storeNow = (db: DatabaseSync): number =>
  integer(db.prepare("SELECT CAST(unixepoch('subsec') * 1000 AS INTEGER) AS now").get() ?? {}, 'now');

export type Row = Record<string, SQLOutputValue>;

/** A column that must be a number. SQLite answers integers as `number` unless asked for bigints, which nothing here does. */
export const integer = (row: Row, column: string): number => {
  const value = row[column];
  if (typeof value === 'number') {
    return value;
  }

  throw new Error(`Expected column "${column}" to be a number, got ${typeof value}`);
};

export const text = (row: Row, column: string): string => {
  const value = row[column];
  if (typeof value === 'string') {
    return value;
  }

  throw new Error(`Expected column "${column}" to be text, got ${typeof value}`);
};
