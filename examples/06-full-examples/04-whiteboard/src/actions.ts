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
export const RENAME_ACTION = 'board-rename';
export const LOCK_ACTION = 'board-lock';
export const APPLY_ACTION = 'board-apply';
export const VOTE_ACTION = 'board-vote';
export const TIMER_ACTION = 'board-timer';
export const UPLOAD_ACTION = 'board-upload';

const field = (label: string, required = true): ActionField => ({ type: 'text', required, label });

/** Every change to a board takes the board and — for a locked one — the key opening it answered. */
const onBoard = { board: field('Board id'), key: field('Key (a locked board’s)', false) };

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
    input: { title: field('Title', false), template: field('Template', false) }
  },
  steps: [
    { id: 'board', task: 'board.create' },
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
        data: '{ "board": "{{ timed.board }}", "timer": {{ timed.timer|json_encode }} }'
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

const actions = [list, load, open, create, rename, lock, apply, vote, timer, upload];

/** How the server reaches an action. One live version, so the revision a page was published at is ignored. */
export const lookups: ActionLookups = {
  getAction: (_spaceId, actionId) => Promise.resolve(actions.find(entry => entry.id === actionId)),
  listActions: () => Promise.resolve(actions)
};
