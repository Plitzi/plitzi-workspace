import { supersedes } from '../../board/model.ts';

import type { BoardElement } from '../../board/model.ts';

/**
 * A board as one screen holds it: what the server confirmed, with this person's unconfirmed edits on top.
 *
 * Kept apart on purpose. An edit is drawn the moment it is made and sent to the server; the server's answer, heard
 * on the board's channel with everyone else's, becomes the confirmed element and retires the edit. If the server
 * refuses a commit, `rollback` drops every edit it never confirmed and the screen shows exactly what the others see.
 */

type HistoryEntry = Map<string, { before: BoardElement | undefined; after: BoardElement }>;

const HISTORY_LIMIT = 200;

const nonce = (): number => Math.floor(Math.random() * 2 ** 31);

const byZ = (a: BoardElement, b: BoardElement): number => a.z - b.z || (a.id < b.id ? -1 : 1);

export type Scene = ReturnType<typeof createScene>;

export const createScene = () => {
  const confirmed = new Map<string, BoardElement>();
  const pending = new Map<string, BoardElement>();
  const undoStack: HistoryEntry[] = [];
  const redoStack: HistoryEntry[] = [];
  let revision = 0;

  const element = (id: string): BoardElement | undefined => pending.get(id) ?? confirmed.get(id);

  const all = (): BoardElement[] => {
    const merged = new Map(confirmed);
    for (const [id, edit] of pending) {
      merged.set(id, edit);
    }

    return [...merged.values()];
  };

  /** Changes made here: each stamped with the next version, drawn at once, and answered for `onCommit` to send. */
  const stamp = (changes: readonly BoardElement[]): { ops: BoardElement[]; entry: HistoryEntry } => {
    const entry: HistoryEntry = new Map();
    const ops = changes.map(change => {
      const current = element(change.id);
      const next = { ...change, version: (current?.version ?? 0) + 1, nonce: nonce() };
      pending.set(next.id, next);
      entry.set(next.id, { before: entry.get(next.id)?.before ?? current, after: next });

      return next;
    });
    revision += 1;

    return { ops, entry };
  };

  const record = (entry: HistoryEntry): void => {
    undoStack.push(entry);
    if (undoStack.length > HISTORY_LIMIT) {
      undoStack.shift();
    }

    redoStack.length = 0;
  };

  /** Plays an entry back or forward: every element it touched returns to that side, as a NEW version of itself. */
  const replay = (entry: HistoryEntry, side: 'before' | 'after'): { ops: BoardElement[]; entry: HistoryEntry } => {
    const targets = [...entry.values()].map(({ before, after }) =>
      side === 'after' ? after : (before ?? { ...after, deleted: true })
    );

    return stamp(targets);
  };

  return {
    element,
    /** What is on the board, bottom to top. */
    visible: (): BoardElement[] =>
      all()
        .filter(entry => !entry.deleted)
        .sort(byZ),
    get revision() {
      return revision;
    },
    get topZ(): number {
      return all().reduce((top, entry) => Math.max(top, entry.z), 0);
    },
    get bottomZ(): number {
      return all().reduce((bottom, entry) => Math.min(bottom, entry.z), 0);
    },
    canUndo: (): boolean => undoStack.length > 0,
    canRedo: (): boolean => redoStack.length > 0,

    /**
     * Elements as the server holds them — from the first paint, a re-read, or its announcement of a commit. Each is
     * kept if it is newer than what is confirmed, and retires this screen's edit of it once it is at least as new.
     */
    confirm: (elements: readonly BoardElement[]): void => {
      for (const incoming of elements) {
        if (supersedes(incoming, confirmed.get(incoming.id))) {
          confirmed.set(incoming.id, incoming);
        }

        const edit = pending.get(incoming.id);
        if (edit && !supersedes(edit, confirmed.get(incoming.id))) {
          pending.delete(incoming.id);
        }
      }

      revision += 1;
    },

    /** This person's changes, kept in the history. Answers the elements to send. */
    commit: (changes: readonly BoardElement[]): BoardElement[] => {
      if (!changes.length) {
        return [];
      }

      const { ops, entry } = stamp(changes);
      record(entry);

      return ops;
    },

    undo: (): BoardElement[] => {
      const entry = undoStack.pop();
      if (!entry) {
        return [];
      }

      const { ops } = replay(entry, 'before');
      redoStack.push(entry);

      return ops;
    },

    redo: (): BoardElement[] => {
      const entry = redoStack.pop();
      if (!entry) {
        return [];
      }

      const { ops } = replay(entry, 'after');
      undoStack.push(entry);

      return ops;
    },

    /** Every unconfirmed edit dropped, and the history with it: it describes edits that no longer exist. */
    rollback: (): void => {
      pending.clear();
      undoStack.length = 0;
      redoStack.length = 0;
      revision += 1;
    },

    /** Another board: nothing of this one is kept. */
    reset: (elements: readonly BoardElement[]): void => {
      confirmed.clear();
      pending.clear();
      undoStack.length = 0;
      redoStack.length = 0;
      for (const incoming of elements) {
        confirmed.set(incoming.id, incoming);
      }

      revision += 1;
    }
  };
};
