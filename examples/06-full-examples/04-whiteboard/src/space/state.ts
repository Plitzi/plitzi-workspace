import { setState, when } from '@plitzi/sdk-authoring';

import { COLLAB_COLOURS, GUEST_NAMES } from '../board/people.ts';

import type { StepSpec } from '@plitzi/sdk-authoring';

/**
 * The page's state: what the person chose, and the values the panels derive from it.
 *
 * Keys in `runtime.state`, written by flows; every panel reads `computed`, where each default is applied once — so a
 * palette nobody has touched still shows ink as chosen, and "the tool" means the same thing to the toolbar, the canvas
 * and the keyboard.
 */

const list = (values: readonly string[]): string => `[${values.map(value => `'${value}'`).join(', ')}]`;

/** A name and a colour for somebody who has not picked one: drawn once, then kept. */
export const RANDOM_NAME = `{{ ${list(GUEST_NAMES)}|random }}`;

export const RANDOM_COLOUR = `{{ ${list(COLLAB_COLOURS)}|random }}`;

/**
 * The id this visitor keeps, which their votes are counted by: sixteen random characters, drawn once and kept — a
 * vote is one per person, not one per visit.
 */
export const RANDOM_VISITOR = `{{ ${Array.from({ length: 16 }, () => "('abcdefghijklmnopqrstuvwxyz0123456789'|random)").join(' ~ ')} }}`;

/** The tools that draw: while one is in hand, the style panel is what it will draw with. */
const DRAWING_TOOLS = ['rectangle', 'ellipse', 'diamond', 'arrow', 'line', 'freehand', 'text', 'sticky'];

export const computed = {
  tool: "{{ state.tool ?? 'select' }}",
  stroke: "{{ state.stroke ?? 'ink' }}",
  fill: "{{ state.fill ?? 'none' }}",
  strokeWidth: '{{ state.strokeWidth ?? 2 }}',
  zoom: '{{ state.zoom ?? 100 }}',
  selectionCount: '{{ state.selectionCount ?? 0 }}',
  /** Whether anything selected belongs to a group — what shows "ungroup". */
  selectionGrouped: '{{ state.selectionGrouped ? true : false }}',
  /** Two or more things that are not already one group: what shows "group". */
  canGroup: '{{ computed.selectionCount > 1 and not state.selectionOneGroup ? true : false }}',
  /** The style panel is open while something is selected or a drawing tool is in hand — and only then. */
  styleOpen: `{{ computed.selectionCount > 0 or computed.tool in ${list(DRAWING_TOOLS)} ? true : false }}`,
  name: "{{ state.name ?? '' }}",
  color: "{{ state.color ?? 'indigo' }}",
  /** Whether this person has been given a name and a colour yet — on a first visit, neither. */
  hasName: '{{ state.name ? true : false }}',
  hasColour: '{{ state.color ? true : false }}',
  hasVisitor: '{{ state.visitor ? true : false }}',
  visitor: "{{ state.visitor ?? '' }}",
  timerOpen: '{{ state.timerOpen ? true : false }}',
  /** What this page announces on the board's room: the only thing the others know about it. */
  me: "{{ { 'name': computed.name, 'color': computed.color } }}",
  shareOpen: '{{ state.shareOpen ? true : false }}',
  meOpen: '{{ state.meOpen ? true : false }}',
  keysOpen: '{{ state.keysOpen ? true : false }}',
  /** Whose view this page follows — a name, or empty. */
  following: "{{ state.following ?? '' }}"
};

/**
 * Kept across visits: who this person is, and the style they draw with. Not kept: where they were — a tool left in
 * hand, a selection count, a panel open on arrival are all things that belong to the last visit, not this one.
 */
export const transientState = [
  'tool',
  'zoom',
  'selectionCount',
  'selectionGrouped',
  'selectionOneGroup',
  'shareOpen',
  'meOpen',
  'keysOpen',
  'titleDraft',
  'following',
  'timerOpen',
  // What opening a locked board answered, and the last timer heard: this visit's, never kept. The KEY that opened it
  // (`unlock`) is kept, so the board opens by itself next time.
  'opened',
  'timer'
];

/** A visitor gets a name, a colour and an id to vote by — the same the boards give them, kept across both. */
export const identity: StepSpec[] = [
  when(
    { field: 'computed.hasName', operator: '=', value: false },
    setState({ key: 'name', type: 'text', value: RANDOM_NAME })
  ),
  when(
    { field: 'computed.hasColour', operator: '=', value: false },
    setState({ key: 'color', type: 'text', value: RANDOM_COLOUR })
  ),
  when(
    { field: 'computed.hasVisitor', operator: '=', value: false },
    setState({ key: 'visitor', type: 'text', value: RANDOM_VISITOR })
  )
];
