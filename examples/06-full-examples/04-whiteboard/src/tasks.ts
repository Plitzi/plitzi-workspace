import { isBoardId } from './board/model.ts';
import { applyToBoard, createBoard, listBoards, loadBoard, renameBoard } from './board/store.ts';

import type { ActionTask } from '@plitzi/sdk-server/actions';

/**
 * What this deployment can do on the server: keep boards.
 *
 * Five tasks over the action `kv`, and not one of them speaks to a page. Telling everyone on a board what changed is
 * the `realtime.publish` step that follows `board.apply` in the action document — a task the server ships — so the
 * same commit could as well be announced by email, or not at all, without a line changing here.
 */

/** Refused rather than looked up: a board id is interpolated into a key, so only an id's own characters get there. */
const boardId = (id: unknown): string => {
  if (!isBoardId(id)) {
    throw new Error(`"${String(id)}" is not a board`);
  }

  return id;
};

const boardParam = { type: 'text', canBind: true, defaultValue: '', label: 'Board id' } as const;

export const boardListTask: ActionTask = {
  namespace: 'board',
  action: 'list',
  title: 'List Boards',
  description: 'The boards touched last, newest first, each with a preview of its drawing.',
  params: {},
  run: async (_params, ctx) => ({ boards: await listBoards(ctx.kv) })
};

export const boardLoadTask: ActionTask<{ id: string }> = {
  namespace: 'board',
  action: 'load',
  title: 'Load Board',
  description: 'One board: its title and every element on it.',
  params: { id: boardParam },
  // An id that is not one is a board that does not exist — the page says so — rather than an error page.
  run: ({ id }, ctx) =>
    isBoardId(id) ? loadBoard(ctx.kv, id) : { found: false, id: String(id), title: '', elements: [] }
};

export const boardCreateTask: ActionTask<{ title: string }> = {
  namespace: 'board',
  action: 'create',
  title: 'Create Board',
  params: { title: { type: 'text', canBind: true, defaultValue: '', label: 'Title' } },
  run: ({ title }, ctx) => createBoard(ctx.kv, title)
};

export const boardRenameTask: ActionTask<{ board: string; title: string }> = {
  namespace: 'board',
  action: 'rename',
  title: 'Rename Board',
  params: { board: boardParam, title: { type: 'text', canBind: true, defaultValue: '', label: 'Title' } },
  run: ({ board, title }, ctx) => renameBoard(ctx.kv, boardId(board), title)
};

export const boardApplyTask: ActionTask<{ board: string; ops: unknown }> = {
  namespace: 'board',
  action: 'apply',
  title: 'Apply To Board',
  description: 'Validates a commit, merges it element by element (last write wins) and keeps it.',
  params: {
    board: boardParam,
    ops: { type: 'codemirror-json', canBind: true, defaultValue: '[]', label: 'Elements' }
  },
  // `callerId` is who is asking as the transport saw them: what a visitor's commits are counted against.
  run: ({ board, ops }, ctx) => applyToBoard(ctx.kv, boardId(board), ops, ctx.callerId)
};

// The catalog is heterogeneous by nature — each task declares its own params — and the server reads it as such.
export const boardTasks = [
  boardListTask,
  boardLoadTask,
  boardCreateTask,
  boardRenameTask,
  boardApplyTask
] as ActionTask<Record<string, unknown>>[];
