import type { Box, Camera, Handle } from './geometry.ts';
import type { StyleChoice } from './styling.ts';
import type { BoardElement, Fill, Point, Reply, Stroke, StrokeWidth, StyleField } from '../../board/model.ts';

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
  /** The rest of the style new elements are drawn with — dash, sloppiness, edges, fill style, opacity. */
  extras: StyleChoice;
};

/** Where the text being typed sits on screen, for the field the component lays over the canvas. */
export type TextEditor = {
  id: string;
  text: string;
  left: number;
  top: number;
  width: number;
  minHeight: number;
  fontSize: number;
  font: string;
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
      /** The selection is one card or comment — what can be ticked off — and whether it is. */
      task: boolean;
      done: boolean;
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
   * in another frame when let go: the selected things that are not frames.
   */
  | { kind: 'move'; origin: Point; originals: BoardElement[]; loose: string[] }
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

/** A sticky or a pile taken off the tray, following the pointer until it is put down. */
export type Carrying = { element: BoardElement; from?: Point; moved: boolean; over: boolean };
