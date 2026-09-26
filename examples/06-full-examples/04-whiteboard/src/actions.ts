import { defineAction } from '@plitzi/sdk-authoring';

import type { ActionLookups } from '@plitzi/sdk-server/actions';

/** The topics, as the space declares them and the actions announce on them — one spelling for both. */
export const TOPICS = {
  /** A board's saved elements. Only the server speaks here: what arrives was validated and kept first. */
  board: 'board:{id}',
  /** A board's room: who is here, their cursors and what they are dragging. Pages speak directly. */
  room: 'room:{id}',
  /** The gallery: a board changed somewhere, so the list may be stale. */
  boards: 'boards'
} as const;

export const LIST_ACTION = 'board-list';
export const LOAD_ACTION = 'board-load';
export const CREATE_ACTION = 'board-create';
export const RENAME_ACTION = 'board-rename';
export const APPLY_ACTION = 'board-apply';

/** The gallery, built into the first paint. Never cached: a board drawn a second ago belongs in it. */
const list = defineAction({
  id: LIST_ACTION,
  name: 'Boards',
  description: 'The boards touched last, with a preview of each.',
  trigger: { type: 'render', access: 'public' },
  steps: [{ id: 'list', task: 'board.list' }]
});

/**
 * One board, built into the first paint of `/b/{id}` — so a board arrives drawn, and somebody joining late starts from
 * everything saved so far rather than from a replay of the channel.
 */
const load = defineAction({
  id: LOAD_ACTION,
  name: 'Board',
  description: 'One board, with every element on it.',
  trigger: {
    type: 'render',
    access: 'public',
    // The route param: `/b/{{id}}` is the page's slug, and a render trigger's input is its route and query params.
    input: { id: { type: 'text', required: true, label: 'Board id' } }
  },
  steps: [{ id: 'board', task: 'board.load' }]
});

const create = defineAction({
  id: CREATE_ACTION,
  name: 'New board',
  description: 'Starts an empty board and answers its id, for the page to go to.',
  trigger: { type: 'call', access: 'public', input: { title: { type: 'text', label: 'Title' } } },
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
  trigger: {
    type: 'call',
    access: 'public',
    input: {
      board: { type: 'text', required: true, label: 'Board id' },
      title: { type: 'text', required: true, label: 'Title' }
    }
  },
  steps: [
    { id: 'renamed', task: 'board.rename' },
    {
      id: 'announce',
      task: 'realtime.publish',
      params: { topic: 'board:{{ input.board }}', type: 'title', data: '{{ renamed }}' }
    },
    { id: 'listed', task: 'realtime.publish', params: { topic: 'boards', type: 'changed', data: '{{ renamed }}' } }
  ],
  output: '{{ renamed }}'
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
    input: {
      board: { type: 'text', required: true, label: 'Board id' },
      ops: { type: 'json', required: true, label: 'Elements' }
    }
  },
  steps: [
    { id: 'apply', task: 'board.apply' },
    {
      id: 'announce',
      task: 'realtime.publish',
      params: { topic: 'board:{{ input.board }}', type: 'elements', data: '{{ apply.settled }}' }
    },
    {
      id: 'listed',
      task: 'realtime.publish',
      params: { topic: 'boards', type: 'changed', data: '{ "id": "{{ input.board }}" }' }
    }
  ],
  // The caller needs nothing back — its answer arrives on the channel with everyone else's.
  output: '{ "ok": true }'
});

const actions = [list, load, create, rename, apply];

/** How the server reaches an action. One live version, so the revision a page was published at is ignored. */
export const lookups: ActionLookups = {
  getAction: (_spaceId, actionId) => Promise.resolve(actions.find(entry => entry.id === actionId)),
  listActions: () => Promise.resolve(actions)
};
