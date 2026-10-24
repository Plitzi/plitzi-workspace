import { openDatabase } from './open';
import { documentOf, stateOf } from '../actions/jobs/queueDocument';
import { applyRule, changedBy, emptyState, queueOver, queueRules } from '../actions/jobs/queueRules';

import type { QueueState } from '../actions/jobs/queueRules';
import type { JobQueue } from '@plitzi/sdk-shared';
import type { DatabaseSync } from 'node:sqlite';

export type SqliteJobQueueOptions = (
  | {
      /** The database file — created, with its folder, when it is not there. Opened in WAL mode. */
      file: string;
      db?: never;
    }
  | {
      /** A database the deployment opened and shares with its own tables — its `kv` (`createSqliteKv`) among them. */
      db: DatabaseSync;
      file?: never;
    }
) & {
  /** The table the queue lives in, created when it is not there. Default `action_jobs`. */
  table?: string;
  /** How many finished jobs to keep before the oldest are dropped. Default 500. */
  retainFinished?: number;
  /** What the queue calls now, in epoch ms: every process on the file reads the machine's clock. */
  clock?: () => number;
};

/**
 * The job queue in a SQLite file, over Node's own `node:sqlite`: what `ctx.later`, a schedule's fires and a function's
 * jobs wait in, surviving a restart AND shared — every process on the file (replicas on one machine, a server started
 * with `workers`) claims from the same queue, each job by one of them.
 *
 * ```ts
 * import { createSqliteJobQueue, createSqliteKv } from '@plitzi/sdk-server/sqlite';
 *
 * createServer({ action: { kv: createSqliteKv({ db }), jobs: { queue: createSqliteJobQueue({ db }) } } });
 * ```
 *
 * The rules are the in-process queue's, to the letter (`queueRules`), run on the state as the table holds it, inside
 * one `BEGIN IMMEDIATE` transaction a call: two processes never claim one job, nor write over each other's change. The
 * state is one row, read whole each call — right for what a project's queue holds (its jobs waiting and the last
 * `retainFinished` done); a deployment of thousands a minute keeps its queue in a database (`JobQueue`).
 */
export const createSqliteJobQueue = (options: SqliteJobQueueOptions): JobQueue => {
  const table = options.table ?? 'action_jobs';
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) {
    throw new Error(
      `createSqliteJobQueue: "${table}" is not a table name (letters, digits and _, not starting with a digit).`
    );
  }

  const db = options.db ?? openDatabase(options.file);
  db.exec(`CREATE TABLE IF NOT EXISTS ${table} (id INTEGER PRIMARY KEY CHECK (id = 1), document TEXT NOT NULL)`);
  const statements = {
    read: db.prepare(`SELECT document FROM ${table} WHERE id = 1`),
    write: db.prepare(
      `INSERT INTO ${table} (id, document) VALUES (1, ?) ON CONFLICT (id) DO UPDATE SET document = excluded.document`
    )
  };
  const rulesOptions = { retainFinished: options.retainFinished ?? 500, clock: options.clock ?? Date.now };

  const read = (): QueueState => {
    const row = statements.read.get();
    if (typeof row?.document !== 'string') {
      return emptyState();
    }

    const state = stateOf(JSON.parse(row.document));
    if (typeof state === 'string') {
      throw new Error(
        `createSqliteJobQueue: the table ${table} holds no queue it wrote (${state}). Point \`table\` elsewhere.`
      );
    }

    return state;
  };

  return queueOver((method, args) => {
    // A write lock taken at once, before the read: another process's change lands before this call, or after it.
    db.exec('BEGIN IMMEDIATE');
    try {
      const state = read();
      const answer = applyRule(queueRules(state, rulesOptions), method, args);
      if (changedBy(method, answer)) {
        statements.write.run(JSON.stringify(documentOf(state)));
      }

      db.exec('COMMIT');

      return Promise.resolve(answer);
    } catch (error) {
      db.exec('ROLLBACK');

      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
};
