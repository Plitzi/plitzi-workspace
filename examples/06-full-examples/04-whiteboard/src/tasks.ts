import { ActionRefusal } from '@plitzi/sdk-server/actions';
import { defineFunctions } from '@plitzi/sdk-server/functions';

import { isBoardId } from './board/model.ts';
import {
  addTemplate,
  applyToBoard,
  copyBoard,
  createBoard,
  deleteBoard,
  listBoards,
  missingBoard,
  loadBoard,
  lockBoard,
  openBoard,
  removeTemplate,
  renameBoard,
  replyTo,
  sayOn,
  setReach,
  setAgentSettings,
  setReadOnly,
  runSession,
  saveTemplate,
  setTimer,
  uploadToBoard,
  voteOn
} from './board/store.ts';
import { TEMPLATES, isTemplate } from './board/templates.ts';

import type { BoardStores } from './board/store.ts';
import type { ActionKvStore } from '@plitzi/sdk-server/actions';
import type { FunctionsDefinition, FunctionTask } from '@plitzi/sdk-server/functions';

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
    throw new ActionRefusal(`"${String(id)}" is not a board`);
  }

  return id;
};

const text = (label: string) => ({ type: 'text', canBind: true, defaultValue: '', label }) as const;

const boardParam = text('Board id');

/** What every change to a locked board carries — the key opening it answered. Ignored on an open board. */
const keyParam = text('Key (a locked board’s, from opening it)');

/** What whoever made a board was given: lets a change through while the board is read-only for everyone else. */
const ownerParam = text('Owner key (from creating or copying the board)');

type Passed = { key: string; owner: string };

/**
 * The tasks, over where this deployment keeps pictures and what it signs keys and topics with — the `kv` is each run's
 * own, handed in by the server already narrowed to the space.
 */
export const createBoardFunctions = ({ assets, signer }: Omit<BoardStores, 'kv'>): FunctionsDefinition => {
  const on = (kv: ActionKvStore): BoardStores => ({ kv, assets, signer });

  const boardListTask: FunctionTask<{ q: string; limit: string }> = {
    namespace: 'board',
    action: 'list',
    title: 'List Boards',
    description:
      'The featured boards and the ones touched last — those whose name holds `q` — the first `limit` of them, each ' +
      'with a preview of its drawing.',
    params: { q: text('Search'), limit: text('How many') },
    run: ({ q, limit }, ctx) => listBoards(on(ctx.kv), { q, limit })
  };

  const boardLoadTask: FunctionTask<{ id: string }> = {
    namespace: 'board',
    action: 'load',
    title: 'Load Board',
    description: 'One board: its title and every element on it — or, locked, only that it exists.',
    params: { id: boardParam },
    // An id that is not one is a board that does not exist — the page says so — rather than an error page.
    run: ({ id }, ctx) =>
      isBoardId(id) ? loadBoard(on(ctx.kv), id, topic => ctx.grant(topic)) : missingBoard(String(id))
  };

  const boardOpenTask: FunctionTask<{ id: string; password: string; key: string }> = {
    namespace: 'board',
    action: 'open',
    title: 'Open Board',
    description: 'A locked board, opened with its password or a key kept from the last time.',
    params: { id: boardParam, password: text('Password'), key: keyParam },
    // `callerId` is who is asking as the transport saw them: what password attempts are counted against.
    run: ({ id, password, key }, ctx) =>
      openBoard(on(ctx.kv), boardId(id), { password, key }, ctx.callerId, topic => ctx.grant(topic))
  };

  const boardCreateTask: FunctionTask<{ title: string; template: string; visibility: string; hours: string }> = {
    namespace: 'board',
    action: 'create',
    title: 'Create Board',
    params: {
      title: text('Title'),
      template: text(`Template (${TEMPLATES.join(' | ')})`),
      visibility: text('Visibility (public | private)'),
      hours: text('Lasts (hours: 1 | 5 | 24 | 168 — empty or 0 for good)')
    },
    run: ({ title, template, visibility, hours }, ctx) =>
      createBoard(on(ctx.kv), title, isTemplate(template) ? template : 'blank', { visibility, hours })
  };

  const boardReachTask: FunctionTask<{ board: string; visibility: string; hours: string } & Passed> = {
    namespace: 'board',
    action: 'reach',
    title: 'Set Board Reach',
    description: 'Who may find a board — listed on the front page, or private — and how long it lasts.',
    params: {
      board: boardParam,
      key: keyParam,
      owner: ownerParam,
      visibility: text('Visibility (public | private)'),
      hours: text('Lasts (hours: 0 | 1 | 5 | 24 | 168, or keep)')
    },
    run: ({ board, key, owner, visibility, hours }, ctx) =>
      setReach(on(ctx.kv), boardId(board), { key, owner }, { visibility, hours })
  };

  const boardReplyTask: FunctionTask<{ board: string; element: string; author: string; text: string } & Passed> = {
    namespace: 'board',
    action: 'reply',
    title: 'Reply To Comment',
    description: 'Adds an answer to a comment’s thread, and answers the comment as it now is.',
    params: {
      board: boardParam,
      key: keyParam,
      owner: ownerParam,
      element: text('Comment id'),
      author: text('Who answers'),
      text: text('The answer')
    },
    run: ({ board, key, owner, element, author, text: said }, ctx) =>
      replyTo(on(ctx.kv), boardId(board), { key, owner }, { element, author, text: said })
  };

  const boardChatTask: FunctionTask<
    { board: string; name: string; color: string; text: string; by: string; agent: string } & Passed
  > = {
    namespace: 'board',
    action: 'chat',
    title: 'Say In Board Chat',
    description: 'Keeps a line of a board’s chat, with who said it, and answers it for the channel.',
    params: {
      board: boardParam,
      key: keyParam,
      owner: ownerParam,
      name: text('Name'),
      color: text('Colour'),
      text: text('What was said'),
      by: text('Who (the id their browser keeps)'),
      agent: text('Said by an agent (true | empty)')
    },
    run: ({ board, key, owner, name, color, text: said, by, agent }, ctx) =>
      sayOn(on(ctx.kv), boardId(board), { key, owner }, { name, color, text: said, by, agent })
  };

  const boardCopyTask: FunctionTask<{ board: string; key: string }> = {
    namespace: 'board',
    action: 'copy',
    title: 'Copy Board',
    description: 'A new board drawn like another — a read-only example, or any board — for the caller to change.',
    params: { board: boardParam, key: keyParam },
    run: ({ board, key }, ctx) => copyBoard(on(ctx.kv), boardId(board), key)
  };

  const boardRenameTask: FunctionTask<{ board: string; title: string } & Passed> = {
    namespace: 'board',
    action: 'rename',
    title: 'Rename Board',
    params: { board: boardParam, title: text('Title'), key: keyParam, owner: ownerParam },
    run: ({ board, title, key, owner }, ctx) => renameBoard(on(ctx.kv), boardId(board), title, { key, owner })
  };

  const boardLockTask: FunctionTask<{ board: string; password: string } & Passed> = {
    namespace: 'board',
    action: 'lock',
    title: 'Lock Board',
    description: 'Sets, changes or — given no password — removes a board’s password.',
    params: { board: boardParam, password: text('Password (empty removes it)'), key: keyParam, owner: ownerParam },
    run: ({ board, password, key, owner }, ctx) => lockBoard(on(ctx.kv), boardId(board), password, { key, owner })
  };

  const boardDeleteTask: FunctionTask<{ board: string } & Passed> = {
    namespace: 'board',
    action: 'delete',
    title: 'Delete Board',
    description: 'Removes a board — never a read-only one — with its pictures.',
    params: { board: boardParam, key: keyParam, owner: ownerParam },
    run: ({ board, key, owner }, ctx) => deleteBoard(on(ctx.kv), boardId(board), { key, owner })
  };

  const boardApplyTask: FunctionTask<{ board: string; ops: unknown } & Passed> = {
    namespace: 'board',
    action: 'apply',
    title: 'Apply To Board',
    description: 'Validates a commit, merges it element by element (last write wins) and keeps it.',
    params: {
      board: boardParam,
      ops: { type: 'codemirror-json', canBind: true, defaultValue: '[]', label: 'Elements' },
      key: keyParam,
      owner: ownerParam
    },
    run: ({ board, ops, key, owner }, ctx) => applyToBoard(on(ctx.kv), boardId(board), ops, { key, owner })
  };

  const boardVoteTask: FunctionTask<{ board: string; element: string; voter: string } & Passed> = {
    namespace: 'board',
    action: 'vote',
    title: 'Vote On Element',
    description: 'Adds a visitor’s vote to an element, or takes it back.',
    params: {
      board: boardParam,
      element: text('Element id'),
      voter: text('Voter (the id a visitor keeps)'),
      key: keyParam,
      owner: ownerParam
    },
    run: ({ board, element, voter, key, owner }, ctx) =>
      voteOn(on(ctx.kv), boardId(board), element, voter, { key, owner })
  };

  const boardTimerTask: FunctionTask<{ board: string; seconds: string } & Passed> = {
    namespace: 'board',
    action: 'timer',
    title: 'Set Board Timer',
    params: { board: boardParam, seconds: text('Seconds (0 stops it)'), key: keyParam, owner: ownerParam },
    run: ({ board, seconds, key, owner }, ctx) => setTimer(on(ctx.kv), boardId(board), seconds, { key, owner })
  };

  const boardSessionTask: FunctionTask<{ board: string; command: string; script: string; host: string } & Passed> = {
    namespace: 'board',
    action: 'session',
    title: 'Run A Session',
    description: 'Starts a session with a script on a board, moves it to its next step, or stops it.',
    params: {
      board: boardParam,
      command: text('start · next · stop'),
      script: text('Script (retro, brainstorm, decide) — to start one'),
      host: text('Who runs it'),
      key: keyParam,
      owner: ownerParam
    },
    run: ({ board, command, script, host, key, owner }, ctx) =>
      runSession(on(ctx.kv), boardId(board), command, script, host, { key, owner })
  };

  const boardUploadTask: FunctionTask<{ board: string; data: string } & Passed> = {
    namespace: 'board',
    action: 'upload',
    title: 'Upload Picture',
    description: 'Keeps a picture (a data URL) beside a board, and answers the asset id an image element names.',
    params: { board: boardParam, data: text('Picture (data URL)'), key: keyParam, owner: ownerParam },
    run: ({ board, data, key, owner }, ctx) => uploadToBoard(on(ctx.kv), boardId(board), data, { key, owner })
  };

  const boardReadOnlyTask: FunctionTask<{ board: string; readOnly: string } & Passed> = {
    namespace: 'board',
    action: 'readonly',
    title: 'Set Board Read-Only',
    description: 'Makes a board read-only for everyone but whoever made it, or opens it again. Only its creator may.',
    params: { board: boardParam, key: keyParam, owner: ownerParam, readOnly: text('Read-only (true | false)') },
    run: ({ board, key, owner, readOnly }, ctx) => setReadOnly(on(ctx.kv), boardId(board), { key, owner }, readOnly)
  };

  const boardAgentsTask: FunctionTask<{ board: string; minutes: string; listens: string } & Passed> = {
    namespace: 'board',
    action: 'agents',
    title: 'Set Agent Settings',
    description:
      'How the agents on a board behave: the minutes one stays through nothing happening, and what wakes one while it ' +
      'listens (named | changes). Either may be left empty.',
    params: {
      board: boardParam,
      key: keyParam,
      owner: ownerParam,
      minutes: text('Minutes'),
      listens: text('What wakes it (named | changes)')
    },
    run: ({ board, key, owner, minutes, listens }, ctx) =>
      setAgentSettings(on(ctx.kv), boardId(board), { key, owner }, { minutes, listens })
  };

  const templateSaveTask: FunctionTask<{ board: string; title: string; elements: unknown } & Passed> = {
    namespace: 'board',
    action: 'templateSave',
    title: 'Save Template',
    description:
      'Keeps what was laid out — a selection, with what its frames hold — as a template in the board’s library, and ' +
      'answers its code, which adds it to any other board.',
    params: {
      board: boardParam,
      title: text('Name'),
      elements: { type: 'codemirror-json', canBind: true, defaultValue: '[]', label: 'Elements' },
      key: keyParam,
      owner: ownerParam
    },
    run: ({ board, title, elements, key, owner }, ctx) =>
      saveTemplate(on(ctx.kv), boardId(board), { title, elements }, { key, owner })
  };

  const templateAddTask: FunctionTask<{ board: string; code: string } & Passed> = {
    namespace: 'board',
    action: 'templateAdd',
    title: 'Add Template',
    description: 'Adds a template another board keeps to this board’s library, by its code.',
    params: { board: boardParam, code: text('Template code'), key: keyParam, owner: ownerParam },
    run: ({ board, code, key, owner }, ctx) => addTemplate(on(ctx.kv), boardId(board), code, { key, owner })
  };

  const templateRemoveTask: FunctionTask<{ board: string; code: string } & Passed> = {
    namespace: 'board',
    action: 'templateRemove',
    title: 'Remove Template',
    description: 'Takes a template out of this board’s library; the other boards that list it keep it.',
    params: { board: boardParam, code: text('Template code'), key: keyParam, owner: ownerParam },
    run: ({ board, code, key, owner }, ctx) => removeTemplate(on(ctx.kv), boardId(board), code, { key, owner })
  };

  return defineFunctions({
    tasks: [
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
      boardSessionTask,
      boardUploadTask,
      boardReachTask,
      boardChatTask,
      boardReplyTask,
      boardReadOnlyTask,
      boardAgentsTask,
      templateSaveTask,
      templateAddTask,
      templateRemoveTask
    ]
  });
};
