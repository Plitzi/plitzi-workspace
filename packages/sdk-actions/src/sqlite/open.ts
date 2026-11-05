import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/** A SQLite file opened for the stores that share it — its folder made when it is not there. */
export const openDatabase = (file: string): DatabaseSync => {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new DatabaseSync(file);
  // WAL so a reader never blocks a writer; `busy_timeout` so two processes reaching for the write lock at once queue
  // for it instead of one of them failing with SQLITE_BUSY.
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;');

  return db;
};
