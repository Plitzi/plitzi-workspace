import type { Box, Camera, Handle } from './geometry.ts';
import type { Guides } from './snapping.ts';
import type { StyleChoice } from './styling.ts';
import type { BoardElement, Duty, Fill, Point, Reply, Stroke, StrokeWidth, StyleField } from '../../board/model.ts';
import type { SavedTemplate } from '../../board/savedTemplates.ts';
import type { BoardSession } from '../../board/sessions.ts';

export const TOOLS = [
  'select',
  'hand',
  'rectangle',
  'ellipse',
  'diamond',
  'triangle',
  'hexagon',
  'cylinder',
  'star',
  'arrow',
  'line',
  'freehand',
  'text',
  'sticky',
  'card',
  'frame',
  /** A frame made a column as it is drawn: a kanban lane. */
  'column',
  'comment',
  'eraser',
  'laser'
] as const;

export type Tool = (typeof TOOLS)[number];

/**
 * The tools that put one thing down — what can also be dragged onto the board from wherever the tool is offered, and
 * lands where it is let go. The others draw with a gesture (a line, a stroke), or do not make anything.
 */
export const PLACED_TOOLS = [
  'rectangle',
  'ellipse',
  'diamond',
  'triangle',
  'hexagon',
  'cylinder',
  'star',
  'text',
  'sticky',
  'card',
  'frame',
  'column',
  'comment'
] as const satisfies readonly Tool[];

export type PlacedTool = (typeof PLACED_TOOLS)[number];

/**
 * - `edit`: everything.
 * - `read`: looking around together — panning, zooming, the laser, reactions, chat, following — and changing nothing.
 * - `view`: a still preview that fits the drawing, takes no pointer and says nothing to the room.
 */
export type BoardMode = 'edit' | 'read' | 'view';

export type ControllerProps = {
  tool: Tool;
  stroke: Stroke;
  fill: Fill;
  strokeWidth: StrokeWidth;
  mode: BoardMode;
  title: string;
  /** Where the board's pictures are served from: `/board-assets/<board>`. */
  assetBase: string;
  /** The id this visitor keeps, which their votes are counted by. */
  voter: string;
  /** This person's name: what a note or a card they write says under it. */
  author: string;
  /** Whether who wrote each note and card is shown — this person's choice, for their own screen. */
  authors: boolean;
  /** Whether the board makes its small sounds — this person's choice too. */
  sounds: boolean;
  /** The session with a script the board is going through, if any: its writing step turns the others' notes over. */
  session: BoardSession | undefined;
  /** The templates in the board's library: what carrying one puts down (`savedTemplates.ts`). */
  templates: readonly SavedTemplate[];
  /** The rest of the style new elements are drawn with — dash, sloppiness, edges, fill style, opacity. */
  extras: StyleChoice;
};

/** Which of an element's words are being written: its text — a card's title — or a card's description. */
export type EditField = 'text' | 'description';

/** A card's description: the second field of its editor, under its title, where the opened card shows it. */
export type EditorField = {
  text: string;
  placeholder: string;
  left: number;
  top: number;
  width: number;
  minHeight: number;
  /** Past this it scrolls: the card drawn around it grows only so far. */
  maxHeight: number;
  fontSize: number;
  lineHeight: number;
  color: string;
};

/** Where the text being typed sits on screen, for the field the component lays over the canvas. */
export type TextEditor = {
  id: string;
  /** What the field holds as it opens, and what it shows while it holds nothing. */
  text: string;
  placeholder?: string;
  /** A card's: its description, a field of its own — the card is edited as a form of two. */
  description?: EditorField;
  /** The field the focus goes to as it opens: where a card was double-clicked. */
  focus: EditField;
  left: number;
  top: number;
  width: number;
  minHeight: number;
  /** A card's fields scroll past this; every other field grows with what is typed. */
  maxHeight?: number;
  fontSize: number;
  font: string;
  weight: number;
  /** Times the font size, as the canvas spaces the lines it draws. */
  lineHeight: number;
  color: string;
  padding: number;
  /** A sticky wraps at its width; a text grows with what is typed. */
  wraps: boolean;
  /** A comment's: typed into a composer that is posted on purpose, not kept when the field is left. */
  composer: boolean;
  /** A shape's label is centred in it, both ways; everything else starts at the top left. */
  align: 'left' | 'center';
  paddingTop: number;
};

/** Where the selection is on screen, for the tools the component lays beside it. */
export type ScreenBox = { left: number; top: number; width: number; height: number };

/** A board box: what a page is looking at, and what a follower's view is set to. */
export type View = [number, number, number, number];

/** What this page says to the room while its pointer moves: where it is, what it is dragging, what it selected. */
export type PointerMessage = {
  /** Where the pointer is — absent while it is off the canvas, when only the view changed. */
  x?: number;
  y?: number;
  /**
   * When it was so, by the sender's clock: the others draw the cursor a moment behind, in step with when each place
   * was reached rather than when its message happened to arrive.
   */
  sentAt: number;
  draft: BoardElement[] | null;
  selection: string[];
  view: View;
  /** The pointer is a laser right now: the others draw its trail. */
  laser?: boolean;
  /** What this person is saying at their cursor — `''` once they closed it. */
  chat?: string;
};

/** What the selection can be restyled with: the style panel shows these, and only these. */
export type Stylable = Record<StyleField, boolean>;

export type ControllerEvent =
  | { type: 'commit'; ops: BoardElement[] }
  | { type: 'tool'; tool: Tool }
  | {
      type: 'selection';
      count: number;
      /** Something selected is in a group. */
      grouped: boolean;
      /** Everything selected is ONE group — grouping it again would change nothing. */
      oneGroup: boolean;
      /** Each field's value the whole selection shares — `''` where it disagrees. */
      style: Record<StyleField, string>;
      stylable: Stylable;
      /** The selection is one frame — what may be made a column, or a free area again — and whether it is a column. */
      frame: boolean;
      column: boolean;
      /** The one column selected marks done what lands in it. */
      completes: boolean;
      /** The selection is one card or comment — what can be ticked off — and whether it is. */
      task: boolean;
      /** The selection is one card: what can wait on other cards. */
      card: boolean;
      done: boolean;
      /** Everything selected is locked — what the lock button then offers to let go. */
      locked: boolean;
      /** The one frame selected's duty for an agent, if it has one. */
      duty: Duty | undefined;
      /** The one frame selected is a branch of another — what may be taken back into its place. */
      branch: boolean;
    }
  | { type: 'selectionBox'; box: ScreenBox | undefined }
  | { type: 'view'; zoom: number }
  | { type: 'editor'; editor: TextEditor | undefined }
  | { type: 'pointer'; message: PointerMessage; final: boolean }
  /** Who this page follows now — their name, or `''` once it stopped. */
  | { type: 'follow'; name: string }
  /** A reaction this person sent, for the room. */
  | { type: 'reaction'; reaction: { emoji: string; x: number; y: number } }
  /** A picture pasted or dropped, shown already, for the page to upload: `id` is the element waiting for it. */
  | { type: 'image'; id: string; data: string }
  /** What is selected, to be kept as a template: named `title`, with what its frames hold, as it lies on the board. */
  | { type: 'templateSave'; title: string; elements: BoardElement[] }
  /** A warning for this person about what they just did: a blocked card moved on, a link refused. */
  | { type: 'notice'; text: string }
  /** A vote asked for — a click on an element's badge, or the selection's vote button. */
  | { type: 'vote'; id: string }
  /** The chat field at the cursor: open (where, on screen), or closed. */
  | { type: 'chat'; at: { left: number; top: number } | undefined }
  /** Everyone asked to come and look where this person looks. */
  | { type: 'summon'; view: View }
  /** Somebody brought everyone to their view — this page included. */
  | { type: 'summoned'; name: string }
  /** A comment selected — its thread, and where on screen it opens — or none any more. */
  | { type: 'thread'; thread: Thread | undefined }
  /** The board's frames changed — what the page lists to go to, in the order a presentation shows them. */
  | { type: 'frames'; frames: FrameEntry[] }
  /** Whether there is anything to undo, or to redo — told when either changes. */
  | { type: 'history'; canUndo: boolean; canRedo: boolean }
  /** Something carried started to move: the page gets out of the way of where it will be put. */
  | { type: 'carry' }
  /** What is searched for, how much it finds, and which of them is shown — `index` from 1, 0 before any. */
  | { type: 'search'; query: string; count: number; index: number }
  /** The session with a script the board goes through — started, moved on a step, or over. */
  | { type: 'session'; session: BoardSession | undefined }
  /** The tags written on the board, most used first. */
  | { type: 'tags'; tags: { tag: string; count: number }[] }
  /** This person presents: the others are shown each frame they go to — and told when it is over (`index: -1`). */
  | { type: 'present'; message: PresentMessage }
  /** A presentation this page is in — its own, or somebody else's — moved on or ended (`presenter: ''`). */
  | { type: 'presentation'; presenter: string; index: number; total: number; title: string; mine: boolean };

/** A comment's thread as the page shows it, beside its pin. */
export type Thread = {
  id: string;
  author: string;
  text: string;
  done: boolean;
  replies: Reply[];
  left: number;
  top: number;
};

/** A frame as the page lists it. */
export type FrameEntry = { id: string; title: string; count: number };

/** What a presenter says to the room at each step: where to look, and where in the presentation that is. */
export type PresentMessage = { view: View; index: number; total: number; title: string };

export type Gesture =
  | { kind: 'pan'; start: Point; camera: Camera }
  /**
   * What is selected, and what rides along — the members of a frame being moved. `loose` are the ones that may land
   * in another frame when let go: the selected things that are not frames. `box` is what was picked up, where it was,
   * and `guides` where what stays still lines up — what its edges snap to.
   */
  | {
      kind: 'move';
      origin: Point;
      originals: BoardElement[];
      ids: ReadonlySet<string>;
      loose: string[];
      box: Box;
      guides: Guides;
    }
  | { kind: 'resize'; handle: Handle; anchor: Point; box: Box; originals: BoardElement[] }
  | { kind: 'marquee'; origin: Point; current: Point; base: Set<string> }
  | { kind: 'box'; origin: Point; element: BoardElement; column?: boolean }
  /**
   * A connector being drawn. `facing` is the shape it was started INSIDE: its anchor is not chosen yet — it is the
   * side facing wherever the other end is, and follows it until the pointer is let go.
   */
  | { kind: 'linear'; origin: Point; element: BoardElement; facing?: string; quick?: boolean }
  | { kind: 'freehand'; element: BoardElement }
  | { kind: 'erase'; erased: Set<string> }
  /** One end of the selected connector, dragged to a new place — or to another element's anchor. */
  | { kind: 'endpoint'; which: 'start' | 'end'; element: BoardElement }
  | { kind: 'laser' }
  /** A fresh note being drawn off a pile: it follows the pointer once it has moved; a click selects the pile. */
  | { kind: 'peel'; stack: BoardElement; origin: Point; moved: boolean; element: BoardElement };

/** Two fingers on the board: the distance and middle they started at, and the camera then. */
export type Pinch = { distance: number; center: Point; camera: Camera };

/**
 * What can be carried to the board: what one tool puts down, a pile of notes, a whole kanban board, or one of the
 * templates in the board's library.
 */
export type Carried = PlacedTool | 'stack' | 'kanban' | 'template';

/**
 * What is carried to the board, following the pointer: the elements as they will land — centred on the point they are
 * carried at — what they are, where the pointer took them, whether they have been dragged and whether they are over
 * the board. `drag` is taken by a press that may only have been a click — let go without dragging, nothing is carried
 * and the click does what clicks do.
 */
export type Carrying = {
  elements: BoardElement[];
  what: Carried;
  from?: Point;
  moved: boolean;
  over: boolean;
  drag: boolean;
};
