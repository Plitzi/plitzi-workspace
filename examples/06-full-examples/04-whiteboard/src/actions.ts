import { defineAction } from '@plitzi/sdk-authoring';

import type { ActionField } from '@plitzi/sdk-shared';
import type { ActionLookups } from '@plitzi/sdk-server/actions';

/** The topics, as the space declares them and the actions announce on them — one spelling for both. */
export const TOPICS = {
  /**
   * A board's saved elements. Only the server speaks here: what arrives was validated and kept first. A locked board's
   * `{id}` carries a secret beside the id (`7f3a….k9Q`), which only opening it answers.
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
export const UPLOAD_ACTION = 'board-upload';
export const REACH_ACTION = 'board-reach';
export const CHAT_ACTION = 'board-chat';
export const REPLY_ACTION = 'board-reply';
export const READ_ONLY_ACTION = 'board-readonly';

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

/** Tells the gallery a board changed, so it reads the list again. */
const listed = (board: string) => ({
  id: 'listed',
  task: 'realtime.publish',
  params: { topic: 'boards', type: 'changed', data: `{ "id": "${board}" }` }
});

/** The gallery, built into the first paint. Never cached: a board drawn a second ago belongs in it. */
const list = defineAction({
  id: LIST_ACTION,
  name: 'Boards',
  description: 'The featured boards and the ones touched last, with a preview of each.',
  trigger: { type: 'render', access: 'public' },
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
  output: '{ "id": "{{ renamed.id }}", "title": "{{ renamed.title }}" }'
});

/**
 * A password set, changed or removed. Everyone on the board is told on the topic it HAD — the only one they are
 * listening to — that their key no longer opens it; whoever set it gets the new key and topic back.
 */
const lock = defineAction({
  id: LOCK_ACTION,
  name: 'Lock board',
  description: 'Sets, changes or removes a board’s password.',
  trigger: { type: 'call', access: 'public', input: { ...onBoard, password: field('Password', false) } },
  steps: [
    { id: 'locked', task: 'board.lock' },
    {
      id: 'announce',
      task: 'realtime.publish',
      params: { topic: 'board:{{ locked.previousTopic }}', type: 'locked', data: '{ "id": "{{ locked.id }}" }' }
    },
    listed('{{ input.board }}')
  ],
  output:
    '{ "id": "{{ locked.id }}", "locked": {{ locked.locked }}, "key": "{{ locked.key }}", "topic": "{{ locked.topic }}" }'
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

const actions = [
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
  upload,
  reachAction,
  chat,
  reply,
  readOnly
];

/** How the server reaches an action. One live version, so the revision a page was published at is ignored. */
export const lookups: ActionLookups = {
  getAction: (_spaceId, actionId) => Promise.resolve(actions.find(entry => entry.id === actionId)),
  listActions: () => Promise.resolve(actions)
};
