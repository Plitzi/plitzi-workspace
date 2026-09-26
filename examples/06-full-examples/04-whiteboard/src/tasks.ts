import { isBoardId } from './board/model.ts';
import {
  applyToBoard,
  copyBoard,
  createBoard,
  deleteBoard,
  listBoards,
  loadBoard,
  lockBoard,
  openBoard,
  renameBoard,
  setTimer,
  uploadToBoard,
  voteOn
} from './board/store.ts';
import { isTemplate } from './board/templates.ts';

import type { ActionTask } from '@plitzi/sdk-server/actions';

/**
 * What this deployment can do on the server: keep boards.
 *
 * Tasks over the action `kv`, and not one of them speaks to a page. Telling everyone on a board what changed is the
 * `realtime.publish` step that follows in each action document — a task the server ships — on the topic the task
 * answers, which for a locked board carries a secret only whoever opened it knows.
 */

/** Refused rather than looked up: a board id is interpolated into a key, so only an id's own characters get there. */
const boardId = (id: unknown): string => {
  if (!isBoardId(id)) {
    throw new Error(`"${String(id)}" is not a board`);
  }

  return id;
};

const text = (label: string) => ({ type: 'text', canBind: true, defaultValue: '', label }) as const;

const boardParam = text('Board id');

/** What every change to a locked board carries — the key opening it answered. Ignored on an open board. */
const keyParam = text('Key (a locked board’s, from opening it)');

export const boardListTask: ActionTask = {
  namespace: 'board',
  action: 'list',
  title: 'List Boards',
  description: 'The featured boards and the ones touched last, each with a preview of its drawing.',
  params: {},
  run: (_params, ctx) => listBoards(ctx.kv)
};

export const boardLoadTask: ActionTask<{ id: string }> = {
  namespace: 'board',
  action: 'load',
  title: 'Load Board',
  description: 'One board: its title and every element on it — or, locked, only that it exists.',
  params: { id: boardParam },
  // An id that is not one is a board that does not exist — the page says so — rather than an error page.
  run: ({ id }, ctx) =>
    isBoardId(id)
      ? loadBoard(ctx.kv, id)
      : {
          found: false,
          id: String(id),
          title: '',
          locked: false,
          readOnly: false,
          elements: [],
          topic: '',
          key: '',
          timer: null
        }
};

export const boardOpenTask: ActionTask<{ id: string; password: string; key: string }> = {
  namespace: 'board',
  action: 'open',
  title: 'Open Board',
  description: 'A locked board, opened with its password or a key kept from the last time.',
  params: { id: boardParam, password: text('Password'), key: keyParam },
  // `callerId` is who is asking as the transport saw them: what password attempts are counted against.
  run: ({ id, password, key }, ctx) => openBoard(ctx.kv, boardId(id), { password, key }, ctx.callerId)
};

export const boardCreateTask: ActionTask<{ title: string; template: string }> = {
  namespace: 'board',
  action: 'create',
  title: 'Create Board',
  params: { title: text('Title'), template: text('Template (blank | brainstorm | retro | flowchart | kanban)') },
  run: ({ title, template }, ctx) => createBoard(ctx.kv, title, isTemplate(template) ? template : 'blank')
};

export const boardCopyTask: ActionTask<{ board: string; key: string }> = {
  namespace: 'board',
  action: 'copy',
  title: 'Copy Board',
  description: 'A new board drawn like another — a read-only example, or any board — for the caller to change.',
  params: { board: boardParam, key: keyParam },
  run: ({ board, key }, ctx) => copyBoard(ctx.kv, boardId(board), key)
};

export const boardRenameTask: ActionTask<{ board: string; title: string; key: string }> = {
  namespace: 'board',
  action: 'rename',
  title: 'Rename Board',
  params: { board: boardParam, title: text('Title'), key: keyParam },
  run: ({ board, title, key }, ctx) => renameBoard(ctx.kv, boardId(board), title, key)
};

export const boardLockTask: ActionTask<{ board: string; password: string; key: string }> = {
  namespace: 'board',
  action: 'lock',
  title: 'Lock Board',
  description: 'Sets, changes or — given no password — removes a board’s password.',
  params: { board: boardParam, password: text('Password (empty removes it)'), key: keyParam },
  run: ({ board, password, key }, ctx) => lockBoard(ctx.kv, boardId(board), password, key)
};

export const boardDeleteTask: ActionTask<{ board: string; key: string }> = {
  namespace: 'board',
  action: 'delete',
  title: 'Delete Board',
  description: 'Removes a board — never a read-only one — with its pictures.',
  params: { board: boardParam, key: keyParam },
  run: ({ board, key }, ctx) => deleteBoard(ctx.kv, boardId(board), key)
};

export const boardApplyTask: ActionTask<{ board: string; ops: unknown; key: string }> = {
  namespace: 'board',
  action: 'apply',
  title: 'Apply To Board',
  description: 'Validates a commit, merges it element by element (last write wins) and keeps it.',
  params: {
    board: boardParam,
    ops: { type: 'codemirror-json', canBind: true, defaultValue: '[]', label: 'Elements' },
    key: keyParam
  },
  // `callerId` is who is asking as the transport saw them: what a visitor's commits are counted against.
  run: ({ board, ops, key }, ctx) => applyToBoard(ctx.kv, boardId(board), ops, ctx.callerId, key)
};

export const boardVoteTask: ActionTask<{ board: string; element: string; voter: string; key: string }> = {
  namespace: 'board',
  action: 'vote',
  title: 'Vote On Element',
  description: 'Adds a visitor’s vote to an element, or takes it back.',
  params: {
    board: boardParam,
    element: text('Element id'),
    voter: text('Voter (the id a visitor keeps)'),
    key: keyParam
  },
  run: ({ board, element, voter, key }, ctx) => voteOn(ctx.kv, boardId(board), element, voter, key)
};

export const boardTimerTask: ActionTask<{ board: string; seconds: string; key: string }> = {
  namespace: 'board',
  action: 'timer',
  title: 'Set Board Timer',
  params: { board: boardParam, seconds: text('Seconds (0 stops it)'), key: keyParam },
  run: ({ board, seconds, key }, ctx) => setTimer(ctx.kv, boardId(board), seconds, key)
};

export const boardUploadTask: ActionTask<{ board: string; data: string; key: string }> = {
  namespace: 'board',
  action: 'upload',
  title: 'Upload Picture',
  description: 'Keeps a picture (a data URL) beside a board, and answers the asset id an image element names.',
  params: { board: boardParam, data: text('Picture (data URL)'), key: keyParam },
  run: ({ board, data, key }, ctx) => uploadToBoard(ctx.kv, boardId(board), data, key)
};

// The catalog is heterogeneous by nature — each task declares its own params — and the server reads it as such.
export const boardTasks = [
  boardListTask,
  boardLoadTask,
  boardOpenTask,
  boardCreateTask,
  boardCopyTask,
  boardRenameTask,
  boardLockTask,
  boardDeleteTask,
  boardApplyTask,
  boardVoteTask,
  boardTimerTask,
  boardUploadTask
] as ActionTask<Record<string, unknown>>[];
