import { setState, when } from '@plitzi/sdk-authoring';

import { CATEGORIES, entriesOf, isGroup } from './elements.ts';
import { COLLAB_COLOURS, GUEST_NAMES } from '../board/people.ts';

import type { StepSpec } from '@plitzi/sdk-authoring';

/**
 * The page's state: what the person chose, and the values the panels derive from it.
 *
 * Keys in `runtime.state`, written by flows; every panel reads `computed`, where each default is applied once — so a
 * palette nobody has touched still shows ink as chosen, and "the tool" means the same thing to the toolbar, the canvas
 * and the keyboard.
 */

const GROUPS = CATEGORIES.filter(isGroup);

const PICK_OF = (group: string): string => `${group}Pick`;

const list = (values: readonly string[]): string => `[${values.map(value => `'${value}'`).join(', ')}]`;

/** A name and a colour for somebody who has not picked one: drawn once, then kept. */
export const RANDOM_NAME = `{{ ${list(GUEST_NAMES)}|random }}`;

export const RANDOM_COLOUR = `{{ ${list(COLLAB_COLOURS)}|random }}`;

/**
 * The id this visitor keeps, which their votes are counted by: sixteen random characters, drawn once and kept — a
 * vote is one per person, not one per visit.
 */
export const RANDOM_VISITOR = `{{ ${Array.from({ length: 16 }, () => "('abcdefghijklmnopqrstuvwxyz0123456789'|random)").join(' ~ ')} }}`;

/** The tools that draw, by what what they draw is styled with: the style panel offers that, and nothing else. */
const SHAPE_TOOLS = ['rectangle', 'ellipse', 'diamond', 'triangle', 'hexagon', 'cylinder', 'star'];

const FRAME_TOOLS = ['frame', 'column'];

const STROKED_TOOLS = [...SHAPE_TOOLS, 'arrow', 'line', 'freehand', 'text'];

const FILLED_TOOLS = [...SHAPE_TOOLS, ...FRAME_TOOLS, 'sticky', 'card'];

const DASHED_TOOLS = [...SHAPE_TOOLS, 'arrow', 'line'];

const CORNERED_TOOLS = ['rectangle', 'diamond', 'triangle', 'hexagon'];

const SEE_THROUGH_TOOLS = [...STROKED_TOOLS, 'sticky', 'card'];

/**
 * Whether one section of the style panel has something to style — the selection, when there is one; the tool in hand,
 * when there is not. An expression, for templates that go on to say more.
 */
const offering = (canKey: string, tools: readonly string[]): string =>
  `(computed.selectionCount > 0 ? (state.${canKey} ? true : false) : (computed.tool in ${list(tools)}))`;

const offers = (canKey: string, tools: readonly string[]): string => `{{ ${offering(canKey, tools)} }}`;

export const computed = {
  tool: "{{ state.tool ?? 'select' }}",
  dash: "{{ state.dash ?? 'solid' }}",
  sloppiness: "{{ state.sloppiness ?? 'artist' }}",
  brush: "{{ state.brush ?? 'pizarra' }}",
  edges: "{{ state.edges ?? 'sharp' }}",
  fillStyle: "{{ state.fillStyle ?? 'hachure' }}",
  opacity: '{{ state.opacity ?? 100 }}',
  stroke: "{{ state.stroke ?? 'ink' }}",
  fill: "{{ state.fill ?? 'none' }}",
  strokeWidth: '{{ state.strokeWidth ?? 2 }}',
  zoom: '{{ state.zoom ?? 100 }}',
  selectionCount: '{{ state.selectionCount ?? 0 }}',
  /** Whether anything selected belongs to a group — what shows "ungroup". */
  selectionGrouped: '{{ state.selectionGrouped ? true : false }}',
  /** Two or more things that are not already one group: what shows "group". */
  canGroup: '{{ computed.selectionCount > 1 and not state.selectionOneGroup ? true : false }}',
  showStroke: offers('selectionCanStroke', STROKED_TOOLS),
  showFill: offers('selectionCanFill', FILLED_TOOLS),
  showWidth: offers('selectionCanWidth', STROKED_TOOLS),
  showDash: offers('selectionCanDash', DASHED_TOOLS),
  showSloppiness: offers('selectionCanSloppiness', DASHED_TOOLS),
  showEdges: offers('selectionCanEdges', CORNERED_TOOLS),
  showBrush: offers('selectionCanBrush', ['freehand']),
  /** The selection is one card or comment: what can be ticked done, or resolved. */
  selectionIsTask: '{{ state.selectionIsTask ? true : false }}',
  selectionIsDone: '{{ state.selectionIsDone ? true : false }}',
  selectionIsLocked: '{{ state.selectionIsLocked ? true : false }}',
  /** Nothing to undo, or to redo — until the canvas says otherwise: a board just opened has no history. */
  nothingToUndo: '{{ state.canUndo ? false : true }}',
  nothingToRedo: '{{ state.canRedo ? false : true }}',
  /** How a fill is drawn matters only once there is a fill. */
  showFillStyle: `{{ ${offering('selectionCanFillStyle', SHAPE_TOOLS)} and computed.fill != 'none' ? true : false }}`,
  showOpacity: offers('selectionCanOpacity', SEE_THROUGH_TOOLS),
  /** Layers are about what is there: something must be selected. */
  showLayers: '{{ computed.selectionCount > 0 ? true : false }}',
  /**
   * The style panel is open while something is selected and it has something to offer that — the choice of shape
   * first, when the shapes are open. What a new shape is drawn with is the last style chosen.
   */
  styleOpen:
    '{{ not (state.shapesOpen or state.linesOpen or state.drawOpen or state.notesOpen or state.kanbanOpen) and computed.selectionCount > 0 and (computed.showStroke or computed.showFill or computed.showWidth or computed.showOpacity or computed.showLayers) ? true : false }}',
  /** The selection is one frame: what may be made a column, and presented from. */
  selectionIsFrame: '{{ state.selectionIsFrame ? true : false }}',
  selectionIsColumn: '{{ state.selectionIsColumn ? true : false }}',
  /** Two or more things: what may be tidied into a grid. */
  canTidy: '{{ computed.selectionCount > 1 ? true : false }}',
  /** The board's frames, in the order they are gone through — what the frames panel lists. */
  frames: '{{ state.frames ?? [] }}',
  /** The elements this person starred in the library, by entry id: shown first there. Kept across visits. */
  favorites: '{{ state.favorites ?? [] }}',
  hasFrames: '{{ state.frames|length > 0 ? true : false }}',
  /** A presentation this page is in: who gives it (`You`, a name, or empty), where it is, and the frame's title. */
  presenter: "{{ state.presentation.presenter ?? '' }}",
  presentingMine: '{{ state.presentation.mine and computed.presenter ? true : false }}',
  presentingOther: '{{ not state.presentation.mine and computed.presenter ? true : false }}',
  presentationStep:
    "{{ computed.presenter ? state.presentation.position ~ ' / ' ~ state.presentation.total ~ ' · ' ~ state.presentation.title : '' }}",
  /** The whole board in a corner — on until this person closes it. */
  minimap: '{{ state.minimap ?? true }}',
  /** The board's small sounds — on until this person turns them off. */
  sounds: '{{ state.sounds ?? true }}',
  /** Who wrote each note and card, shown — on until this person turns it off. */
  showAuthors: '{{ state.showAuthors ?? true }}',
  name: "{{ state.name ?? '' }}",
  color: "{{ state.color ?? 'indigo' }}",
  /** Whether this person has been given a name and a colour yet — on a first visit, neither. */
  hasName: '{{ state.name ? true : false }}',
  hasColour: '{{ state.color ? true : false }}',
  hasVisitor: '{{ state.visitor ? true : false }}',
  visitor: "{{ state.visitor ?? '' }}",
  /**
   * This page — one tab, one visit — among the others the same visitor may have open: what a change it makes carries,
   * so the announcement of it that comes back is known for its own.
   */
  hasTab: '{{ state.tab ? true : false }}',
  tab: "{{ state.tab ?? '' }}",
  timerOpen: '{{ state.timerOpen ? true : false }}',
  /** What this page announces on the board's room: the only thing the others know about it. */
  me: "{{ { 'name': computed.name, 'color': computed.color } }}",
  shareOpen: '{{ state.shareOpen ? true : false }}',
  meOpen: '{{ state.meOpen ? true : false }}',
  keysOpen: '{{ state.keysOpen ? true : false }}',
  deleteOpen: '{{ state.deleteOpen ? true : false }}',
  settingsOpen: '{{ state.settingsOpen ? true : false }}',
  stampOpen: '{{ state.stampOpen ? true : false }}',
  reactOpen: '{{ state.reactOpen ? true : false }}',
  shapesOpen: '{{ state.shapesOpen ? true : false }}',
  linesOpen: '{{ state.linesOpen ? true : false }}',
  drawOpen: '{{ state.drawOpen ? true : false }}',
  notesOpen: '{{ state.notesOpen ? true : false }}',
  kanbanOpen: '{{ state.kanbanOpen ? true : false }}',
  /** What each group of the toolbar shows: the last thing picked from it. */
  // What each group's button shows: the last thing picked from it, its first entry until then.
  ...Object.fromEntries(
    GROUPS.map(group => [
      PICK_OF(group.id),
      `{{ state.${PICK_OF(group.id)} ?? '${entriesOf(group.id)[0]?.id ?? ''}' }}`
    ])
  ),
  framesOpen: '{{ state.framesOpen ? true : false }}',
  agentOpen: '{{ state.agentOpen ? true : false }}',
  libraryOpen: '{{ state.libraryOpen ? true : false }}',
  librarySearch: "{{ state.librarySearch ?? '' }}",
  chatOpen: '{{ state.chatOpen ? true : false }}',
  /** Lines said in the chat while it was closed. */
  unread: '{{ state.unread ?? 0 }}',
  /** One of the popovers is open: what a click anywhere else closes. */
  popoverOpen:
    '{{ computed.meOpen or computed.shareOpen or computed.timerOpen or computed.deleteOpen or computed.reactOpen or computed.shapesOpen or computed.linesOpen or computed.drawOpen or computed.notesOpen or computed.kanbanOpen or computed.framesOpen or computed.agentOpen or computed.libraryOpen or computed.settingsOpen or computed.stampOpen ? true : false }}',
  /** Whose view this page follows — a name, or empty. */
  following: "{{ state.following ?? '' }}"
};

/**
 * Kept, and drawn by the server: what the first paint shows of what this person chose — each group's last pick in the
 * toolbar, their name and colour in the avatar, the minimap on or off. The server renders with them from a cookie, so a
 * reload does not paint the defaults and swap these in. Nothing else: the cookie goes with every request.
 */
export const paintedState = [...GROUPS.map(group => PICK_OF(group.id)), 'name', 'color', 'minimap'];

/**
 * Kept across visits: who this person is, and the style they draw with. Not kept: where they were — a tool left in
 * hand, a selection count, a panel open on arrival are all things that belong to the last visit, not this one.
 */
export const transientState = [
  // One per tab and per visit: kept, every tab of a browser would be the same page.
  'tab',
  'lockedHere',
  'tool',
  'zoom',
  'selectionCount',
  'selectionGrouped',
  'selectionOneGroup',
  'selectionCanStroke',
  'selectionCanFill',
  'selectionCanWidth',
  'selectionCanDash',
  'selectionCanSloppiness',
  'selectionCanBrush',
  'selectionIsTask',
  'selectionIsDone',
  'selectionIsLocked',
  'canUndo',
  'canRedo',
  'selectionCanEdges',
  'selectionCanFillStyle',
  'selectionCanOpacity',
  'selectionIsFrame',
  'selectionIsColumn',
  'shapesOpen',
  'linesOpen',
  'drawOpen',
  'notesOpen',
  'kanbanOpen',
  'framesOpen',
  'agentOpen',
  'libraryOpen',
  'librarySearch',
  'chatOpen',
  'chat',
  'unread',
  // What the board holds and who presents are the board's, read again on every visit.
  'frames',
  'presentation',
  'shareOpen',
  'meOpen',
  'keysOpen',
  'titleDraft',
  'following',
  'timerOpen',
  'deleteOpen',
  'settingsOpen',
  'stampOpen',
  'reactOpen',
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
  ),
  when(
    { field: 'computed.hasTab', operator: '=', value: false },
    setState({ key: 'tab', type: 'text', value: RANDOM_VISITOR })
  )
];
