import { integer, storeNow, text } from './database';

import type { DatabaseSync } from 'node:sqlite';

export type ActivityEntry = { id: number; at: number; replica: string; trigger: string; message: string };

export type ActivityLog = {
  append: (entry: { replica: string; trigger: string; message: string }) => void;
  recent: (limit: number) => ActivityEntry[];
};

/**
 * What the jobs DID, as opposed to what became of them.
 *
 * The queue records that a job succeeded; this records what that meant — the reminder, the export, the failure a
 * flaky upstream answered. It lives in the shared file too, so the page shows every replica's work whichever
 * replica is serving it, and the `replica` column is how you see a job move from one process to another.
 */
export const createActivityLog = (db: DatabaseSync, { keep = 100 }: { keep?: number } = {}): ActivityLog => ({
  append: ({ replica, trigger, message }) => {
    db.prepare('INSERT INTO activity (at, replica, trigger_type, message) VALUES (?, ?, ?, ?)').run(
      storeNow(db),
      replica,
      trigger,
      message
    );
    db.prepare('DELETE FROM activity WHERE id <= (SELECT MAX(id) FROM activity) - ?').run(keep);
  },
  recent: limit =>
    db
      .prepare('SELECT * FROM activity ORDER BY id DESC LIMIT ?')
      .all(limit)
      .map(row => ({
        id: integer(row, 'id'),
        at: integer(row, 'at'),
        replica: text(row, 'replica'),
        trigger: text(row, 'trigger_type'),
        message: text(row, 'message')
      }))
});
