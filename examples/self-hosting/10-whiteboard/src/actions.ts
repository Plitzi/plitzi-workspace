import { defineAction } from '@plitzi/sdk-authoring';

import type { ActionLookups } from '@plitzi/sdk-server/actions';
import type { ActionField } from '@plitzi/sdk-shared';

/** The topics, as the space declares them and the actions announce on them — one spelling for both. */
export const TOPICS = {
  /**
   * A board's saved elements. Only the server speaks here: what arrives was validated and kept first. Private, as the
   * room is: a page opens it with the grant `board-load` or `board-open` answered. A locked board's `{id}` carries
   * its password's version (`7f3a….v2`), so a new password is a new topic.
   */
  board: 'board:{id}',
  /** A board's room: who is here, their cursors, lasers, reactions and what they drag. Pages speak directly. */
  room: 'room:{id}',
  /** The gallery: a board changed somewhere, so the list may be stale. */
  boards: 'boards',
  /** The front page: who else is on it right now. */
  lobby: 'lobby'
} as const;

export const LIST_ACTION = 'board-list';
export const LOAD_ACTION = 'board-load';
export const OPEN_ACTION = 'board-open';
export const CREATE_ACTION = 'board-create';
export const COPY_ACTION = 'board-copy';
export const RENAME_ACTION = 'board-rename';
export const LOCK_ACTION = 'board-lock';
export const DELETE_ACTION = 'board-delete';
export const APPLY_ACTION = 'board-apply';
export const VOTE_ACTION = 'board-vote';
export const TIMER_ACTION = 'board-timer';

export const SESSION_ACTION = 'board-session';
export const UPLOAD_ACTION = 'board-upload';
export const REACH_ACTION = 'board-reach';
export const CHAT_ACTION = 'board-chat';
export const REPLY_ACTION = 'board-reply';
export const READ_ONLY_ACTION = 'board-readonly';

export const AGENTS_ACTION = 'board-agents';

export const TEMPLATE_SAVE_ACTION = 'board-template-save';
export const TEMPLATE_ADD_ACTION = 'board-template-add';
export const TEMPLATE_REMOVE_ACTION = 'board-template-remove';

const field = (label: string, required = true): ActionField => ({ type: 'text', required, label });

/**
 * Every change to a board takes the board, the key opening it answered — for a locked one — and, from whoever made it,
 * the owner key that lets a change through while it is read-only for everyone else.
 */
const onBoard = {
  board: field('Board id'),
  key: field('Key (a locked board’s)', false),
  owner: field('Owner key (its creator’s)', false)
};

/**
 * At most `limit` of these from one visitor every `seconds`, refused with `message` past it — counted by the platform's
 * `flow.rateLimit`, per person, before anything is read or kept.
 */
const perVisitor = (bucket: string, limit: number, seconds: number, message: string) => ({
  id: 'limit',
  task: 'flow.rateLimit',
  params: { bucket, limit: String(limit), windowSeconds: String(seconds), per: 'caller', message }
});

/** Tells the gallery a board changed, so it reads the list again. */
const listed = (board: string) => ({
  id: 'listed',
  task: 'realtime.publish',
  params: { topic: 'boards', type: 'changed', data: `{ "id": "${board}" }` }
});

/**
 * The gallery, built into the first paint. Never cached: a board drawn a second ago belongs in it. A search and how
 * many to show come with the page's query params, or with the front page's own reload of it (`reloadApi` with input).
 */
const list = defineAction({
  id: LIST_ACTION,
  name: 'Boards',
  description: 'The featured boards and the ones touched last, with a preview of each — searched, a page at a time.',
  trigger: {
    type: 'render',
    access: 'public',
    input: { q: field('Search', false), limit: field('How many', false) }
  },
  steps: [{ id: 'list', task: 'board.list' }]
});

/**
 * One board, built into the first paint of `/b/{id}` — so a board arrives drawn, and somebody joining late starts from
 * everything saved so far rather than from a replay of the channel. A locked one arrives as a name and a lock.
 */
const load = defineAction({
  id: LOAD_ACTION,
  name: 'Board',
  description: 'One board, with every element on it — or, locked, only its name.',
  trigger: {
    type: 'render',
    access: 'public',
    // The route param: `/b/{{id}}` is the page's slug, and a render trigger's input is its route and query params.
    input: { id: field('Board id') }
  },
  steps: [{ id: 'board', task: 'board.load' }]
});

/** A locked board, opened: what the page shows it with, and the key and topic everything after needs. */
const open = defineAction({
  id: OPEN_ACTION,
  name: 'Open board',
  description: 'Opens a locked board with its password, or with a key the page kept.',
  trigger: {
    type: 'call',
    access: 'public',
    input: { id: field('Board id'), password: field('Password', false), key: field('Key', false) }
  },
  steps: [{ id: 'opened', task: 'board.open' }],
  output: '{{ opened }}'
});

const create = defineAction({
  id: CREATE_ACTION,
  name: 'New board',
  description: 'Starts a board — empty, or from a template — and answers its id, for the page to go to.',
  trigger: {
    type: 'call',
    access: 'public',
    input: {
      title: field('Title', false),
      template: field('Template', false),
      visibility: field('Visibility (public | private)', false),
      hours: field('Lasts (hours)', false)
    }
  },
  steps: [
    { id: 'board', task: 'board.create' },
    { id: 'announce', task: 'realtime.publish', params: { topic: 'boards', type: 'changed', data: '{{ board }}' } }
  ],
  output: '{{ board }}'
});

/** A board used as a template: a copy of it, answered with its id for the page to go to. */
const copy = defineAction({
  id: COPY_ACTION,
  name: 'Copy board',
  description: 'Starts a board drawn like another one, and answers its id, for the page to go to.',
  trigger: { type: 'call', access: 'public', input: onBoard },
  steps: [
    { id: 'board', task: 'board.copy' },
    { id: 'announce', task: 'realtime.publish', params: { topic: 'boards', type: 'changed', data: '{{ board }}' } }
  ],
  output: '{{ board }}'
});

const rename = defineAction({
  id: RENAME_ACTION,
  name: 'Rename board',
  description: 'Renames a board, and tells everyone on it.',
  trigger: { type: 'call', access: 'public', input: { ...onBoard, title: field('Title') } },
  steps: [
    { id: 'renamed', task: 'board.rename' },
    {
      id: 'announce',
      task: 'realtime.publish',
      params: { topic: 'board:{{ renamed.topic }}', type: 'title', data: '{{ renamed }}' }
    },
    listed('{{ input.board }}')
  ],
  // As an object rather than JSON text, which a title with a quotation mark in it broke.
  output: '{{ { "id": renamed.id, "title": renamed.title }|json_encode }}'
});

/**
 * A password set, changed or removed. Everyone on the board is told on the topic it HAD — the only one they are
 * listening to — whether it is locked now, and by which page (`by`), which already holds the new key and topic it was
 * answered and goes on as it is.
 */
const lock = defineAction({
  id: LOCK_ACTION,
  name: 'Lock board',
  description: 'Sets, changes or removes a board’s password.',
  trigger: {
    type: 'call',
    access: 'public',
    input: { ...onBoard, password: field('Password', false), by: field('The page asking (its tab id)', false) }
  },
  steps: [
    { id: 'locked', task: 'board.lock' },
    {
      id: 'announce',
      task: 'realtime.publish',
      params: {
        topic: 'board:{{ locked.previousTopic }}',
        type: 'locked',
        data: '{{ { "id": locked.id, "locked": locked.locked, "by": input.by }|json_encode }}'
      }
    },
    /**
     * Removed, the board is open again — and whoever was left at its lock screen was listening to nothing it had,
     * since its topic is a secret they never opened. A page at the lock screen listens to the open board's own
     * topic instead (`board:{id}`), which is where it is told.
     */
    {
      id: 'reopen',
      task: 'realtime.publish',
      when: { combinator: 'and', rules: [{ field: 'locked.locked', operator: '=', value: false }] },
      params: {
        topic: 'board:{{ locked.topic }}',
        type: 'locked',
        data: '{{ { "id": locked.id, "locked": false, "by": input.by }|json_encode }}'
      }
    },
    listed('{{ input.board }}')
  ],
  output:
    '{{ { "id": locked.id, "locked": locked.locked, "wasLocked": locked.wasLocked, "key": locked.key, "topic": locked.topic }|json_encode }}'
});

/** A board removed: everyone on it is told on its topic — and goes back to the boards — and the gallery reads again. */
const remove = defineAction({
  id: DELETE_ACTION,
  name: 'Delete board',
  description: 'Removes a board for everyone, and tells everyone on it.',
  trigger: { type: 'call', access: 'public', input: onBoard },
  steps: [
    { id: 'deleted', task: 'board.delete' },
    {
      id: 'announce',
      task: 'realtime.publish',
      params: { topic: 'board:{{ deleted.topic }}', type: 'deleted', data: '{ "id": {{ deleted.id|json_encode }} }' }
    },
    listed('{{ deleted.id }}')
  ],
  output: '{ "id": {{ deleted.id|json_encode }} }'
});

/**
 * Every change anyone makes to a board, in the order it is kept.
 *
 * Validate and merge (`board.apply`), then say so: what the channel carries is what the store now holds for each
 * element the commit touched — the commit's own version where it won, the one kept where it lost — so a screen whose
 * edit lost converges on the winner the moment the answer lands. The sender hears it too, and it changes nothing
 * there: it already drew what it sent.
 */
const apply = defineAction({
  id: APPLY_ACTION,
  name: 'Apply to board',
  description: 'Keeps a commit of board elements and announces what they now are.',
  trigger: {
    type: 'call',
    access: 'public',
    input: { ...onBoard, ops: { type: 'json', required: true, label: 'Elements' } }
  },
  steps: [
    // A busy person drawing fast stays well under it.
    perVisitor('commits', 80, 10, 'Too many changes at once — slow down for a moment'),
    { id: 'apply', task: 'board.apply' },
    {
      id: 'announce',
      task: 'realtime.publish',
      params: { topic: 'board:{{ apply.topic }}', type: 'elements', data: '{{ apply.settled }}' }
    },
    listed('{{ input.board }}')
  ],
  // The caller needs nothing back — its answer arrives on the channel with everyone else's.
  output: '{ "ok": true }'
});

/** A vote for an element, or one taken back — kept one at a time, so two people voting at once both count. */
const vote = defineAction({
  id: VOTE_ACTION,
  name: 'Vote',
  description: 'Toggles a visitor’s vote on an element and announces the element with its votes.',
  trigger: {
    type: 'call',
    access: 'public',
    input: { ...onBoard, element: field('Element id'), voter: field('Voter') }
  },
  steps: [
    { id: 'voted', task: 'board.vote' },
    {
      id: 'announce',
      task: 'realtime.publish',
      params: { topic: 'board:{{ voted.topic }}', type: 'elements', data: '{{ voted.settled }}' }
    }
  ],
  output: '{ "ok": true }'
});

/** A countdown for everyone on the board — started, restarted, or stopped at zero. */
const timer = defineAction({
  id: TIMER_ACTION,
  name: 'Timer',
  description: 'Starts or stops the board’s shared timer, and tells everyone on it.',
  trigger: { type: 'call', access: 'public', input: { ...onBoard, seconds: field('Seconds') } },
  steps: [
    { id: 'timed', task: 'board.timer' },
    {
      id: 'announce',
      task: 'realtime.publish',
      params: {
        topic: 'board:{{ timed.topic }}',
        type: 'timer',
        data: '{ "board": {{ timed.board|json_encode }}, "timer": {{ timed.timer|json_encode }} }'
      }
    }
  ],
  output: '{ "ok": true }'
});

/** A session with a script: started, moved on a step, or stopped — for everyone on the board at once. */
const session = defineAction({
  id: SESSION_ACTION,
  name: 'Session',
  description: 'Starts a session with a script on a board, moves it on a step, or stops it — and tells everyone on it.',
  trigger: {
    type: 'call',
    access: 'public',
    input: {
      ...onBoard,
      command: field('start · next · stop'),
      script: field('Script, to start one', false),
      host: field('Who runs it', false)
    }
  },
  steps: [
    { id: 'ran', task: 'board.session' },
    {
      id: 'announce',
      task: 'realtime.publish',
      params: {
        topic: 'board:{{ ran.topic }}',
        type: 'session',
        data: '{ "board": {{ ran.board|json_encode }}, "session": {{ ran.session|json_encode }} }'
      }
    }
  ],
  output: '{ "ok": true }'
});

/**
 * A picture pasted onto a board: kept beside it, answered as an asset id. The element that shows it is committed
 * like any other, once the page has the id — so nobody sees an image the server did not accept.
 */
const upload = defineAction({
  id: UPLOAD_ACTION,
  name: 'Upload picture',
  description: 'Keeps a pasted picture beside the board and answers its asset id.',
  trigger: { type: 'call', access: 'public', input: { ...onBoard, data: field('Picture (data URL)') } },
  steps: [{ id: 'uploaded', task: 'board.upload' }],
  output: '{ "asset": "{{ uploaded.asset }}" }'
});

/**
 * Who may find a board and how long it lasts. Everyone on it is told (`reach`) and reads it again; the gallery reads
 * its list again too — a board made private leaves it.
 */
const reachAction = defineAction({
  id: REACH_ACTION,
  name: 'Board reach',
  description: 'Makes a board public or private, and temporary or lasting.',
  trigger: {
    type: 'call',
    access: 'public',
    input: { ...onBoard, visibility: field('Visibility (public | private)'), hours: field('Lasts (hours, or keep)') }
  },
  steps: [
    { id: 'reached', task: 'board.reach' },
    {
      id: 'announce',
      task: 'realtime.publish',
      params: { topic: 'board:{{ reached.topic }}', type: 'reach', data: '{{ reached|json_encode }}' }
    },
    listed('{{ input.board }}')
  ],
  output: '{{ reached|json_encode }}'
});

/** A line of the board's chat: kept with the last ones, and carried to everyone on the board. */
const chat = defineAction({
  id: CHAT_ACTION,
  name: 'Board chat',
  description: 'Keeps a line of the board’s chat and tells everyone on it.',
  trigger: {
    type: 'call',
    access: 'public',
    input: {
      ...onBoard,
      name: field('Name'),
      color: field('Colour', false),
      text: field('What was said'),
      by: field('Who (the id their browser keeps)', false),
      agent: field('Said by an agent', false)
    }
  },
  steps: [
    // A conversation, not a flood.
    perVisitor('chat', 20, 10, 'That is a lot at once — give the others a moment'),
    { id: 'said', task: 'board.chat' },
    {
      id: 'announce',
      task: 'realtime.publish',
      params: { topic: 'board:{{ said.topic }}', type: 'chat', data: '{{ said.message|json_encode }}' }
    }
  ],
  output: '{{ said.message|json_encode }}'
});

/** An answer in a comment's thread: kept on the server, the comment announced with its thread. */
const reply = defineAction({
  id: REPLY_ACTION,
  name: 'Reply',
  description: 'Adds an answer to a comment’s thread and announces the comment.',
  trigger: {
    type: 'call',
    access: 'public',
    input: { ...onBoard, element: field('Comment id'), author: field('Who answers'), text: field('The answer') }
  },
  steps: [
    { id: 'answered', task: 'board.reply' },
    {
      id: 'announce',
      task: 'realtime.publish',
      params: { topic: 'board:{{ answered.topic }}', type: 'elements', data: '{{ answered.settled|json_encode }}' }
    }
  ],
  output: '{ "ok": true }'
});

/**
 * A board made read-only for everyone but its creator, or opened again. Everyone on it is told (`readOnly`), and their
 * canvas stops — or starts — taking changes; the gallery reads its list again, where a read-only board is marked.
 */
const readOnly = defineAction({
  id: READ_ONLY_ACTION,
  name: 'Read-only board',
  description: 'Makes a board read-only for everyone but whoever made it, or opens it again.',
  trigger: { type: 'call', access: 'public', input: { ...onBoard, readOnly: field('Read-only (true | false)') } },
  steps: [
    { id: 'set', task: 'board.readonly' },
    {
      id: 'announce',
      task: 'realtime.publish',
      params: { topic: 'board:{{ set.topic }}', type: 'readOnly', data: '{{ set|json_encode }}' }
    },
    listed('{{ input.board }}')
  ],
  output: '{{ set|json_encode }}'
});

/**
 * How the agents on a board behave: how long one stays through quiet, and what wakes one while it listens. The agents
 * on it are told (`agents`), and keep to it.
 */
const agents = defineAction({
  id: AGENTS_ACTION,
  name: 'Agents on a board',
  description:
    'How the agents on a board behave: the minutes one stays with nothing happening before it leaves, and what wakes ' +
    'one while it listens — only what names it (named), or every change too (changes).',
  trigger: {
    type: 'call',
    access: 'public',
    input: { ...onBoard, minutes: field('Minutes', false), listens: field('What wakes it', false) }
  },
  steps: [
    { id: 'set', task: 'board.agents' },
    {
      id: 'announce',
      task: 'realtime.publish',
      params: { topic: 'board:{{ set.topic }}', type: 'agents', data: '{{ set|json_encode }}' }
    }
  ],
  output: '{{ set|json_encode }}'
});

/** Everyone on the board is told its library as it now is (`templates`): the pages' libraries and the agents follow. */
const libraryChanged = (step: string) => ({
  id: 'announce',
  task: 'realtime.publish',
  params: {
    topic: `board:{{ ${step}.topic }}`,
    type: 'templates',
    data: `{ "board": {{ ${step}.board|json_encode }}, "templates": {{ ${step}.templates|json_encode }} }`
  }
});

/**
 * What the page that asked is answered: the library as it now is — its own, whatever the channel does — and the
 * template it saved or added (`template`).
 */
const libraryAnswer = (template?: 'saved' | 'added'): string =>
  `{ "board": {{ kept.board|json_encode }}, "templates": {{ kept.templates|json_encode }}${template ? `, "template": {{ kept.${template}|json_encode }}` : ''} }`;

/** What someone laid out, kept as a template in the board's library — answered with its code and name. */
const templateSave = defineAction({
  id: TEMPLATE_SAVE_ACTION,
  name: 'Save template',
  description: 'Keeps a selection — with what its frames hold — as a template in the board’s library.',
  trigger: {
    type: 'call',
    access: 'public',
    input: { ...onBoard, title: field('Name', false), elements: { type: 'json', required: true, label: 'Elements' } }
  },
  steps: [
    // A library filled by hand, never by a script.
    perVisitor('templates', 10, 600, 'That is a lot of templates at once — try again in a few minutes'),
    { id: 'kept', task: 'board.templateSave' },
    libraryChanged('kept')
  ],
  output: libraryAnswer('saved')
});

/** A template another board keeps, added to this board's library by its code. */
const templateAdd = defineAction({
  id: TEMPLATE_ADD_ACTION,
  name: 'Add template',
  description: 'Adds a template to the board’s library by its code.',
  trigger: { type: 'call', access: 'public', input: { ...onBoard, code: field('Template code') } },
  steps: [{ id: 'kept', task: 'board.templateAdd' }, libraryChanged('kept')],
  output: libraryAnswer('added')
});

/** A template taken out of the board's library. */
const templateRemove = defineAction({
  id: TEMPLATE_REMOVE_ACTION,
  name: 'Remove template',
  description: 'Takes a template out of the board’s library.',
  trigger: { type: 'call', access: 'public', input: { ...onBoard, code: field('Template code') } },
  steps: [{ id: 'kept', task: 'board.templateRemove' }, libraryChanged('kept')],
  output: libraryAnswer()
});

/** Every action of the space, as the platform seeds it and this server looks it up — one list for both. */
export const actions = [
  list,
  load,
  open,
  create,
  copy,
  rename,
  lock,
  remove,
  apply,
  vote,
  timer,
  session,
  upload,
  reachAction,
  chat,
  reply,
  readOnly,
  agents,
  templateSave,
  templateAdd,
  templateRemove
];

/** How the server reaches an action. One live version, so the revision a page was published at is ignored. */
export const lookups: ActionLookups = {
  getAction: (_spaceId, actionId) => Promise.resolve(actions.find(entry => entry.id === actionId)),
  listActions: () => Promise.resolve(actions)
};
