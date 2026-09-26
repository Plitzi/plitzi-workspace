/**
 * What a board is made of — one file, read by the browser that draws it and by the server that keeps it.
 *
 * Both halves import THIS, so the shape a canvas commits and the shape the server accepts cannot drift apart: a field
 * added here is drawn, validated and merged by the same definition.
 */

export const SHAPE_TYPES = [
  'rectangle',
  'ellipse',
  'diamond',
  'triangle',
  'hexagon',
  /** A database, as every diagram draws one. */
  'cylinder',
  'star',
  'arrow',
  'line',
  'freehand',
  'text',
  'sticky',
  /** A pile of sticky notes on the board: anyone drags a fresh note off it, in its paper. */
  'stack',
  /** A picture someone pasted or dropped: the image itself is an asset the server keeps beside the board. */
  'image',
  /**
   * A titled area that holds what is put in it: its members move with it, and — laid out as a column — it stacks them
   * itself, which is a kanban column. Always drawn under everything else.
   */
  'frame',
  /** A task: a line of text on a card, a colour strip, who wrote it, and whether it is done. */
  'card',
  /** Feedback pinned to a place: what someone thinks of what is there, who said it, and whether it was dealt with. */
  'comment',
  /**
   * A mark that stays: one emoji (its `text`), drawn to fill its square box — so the box is the mark, and a selection
   * outlines the emoji rather than the line height of a font it is not drawn in.
   */
  'stamp'
] as const;

export type ShapeType = (typeof SHAPE_TYPES)[number];

/**
 * The colours, by NAME. A board stores `ink`, never `#16201c`: the canvas resolves each name from the page's own custom
 * properties, so the same drawing is dark ink on paper in the light scheme and chalk on slate in the dark one.
 */
export const STROKES = ['ink', 'red', 'orange', 'green', 'blue', 'violet'] as const;

export const FILLS = ['none', 'red', 'orange', 'yellow', 'green', 'blue', 'violet'] as const;

export const STROKE_WIDTHS = [1, 2, 4] as const;

/** How an outline is drawn when it is not one solid line. */
export const DASHES = ['dashed', 'dotted'] as const;

/**
 * How much a hand shows in a line — Excalidraw's "sloppiness": an architect's clean one, the artist's wobble (the
 * default, and so never stored), a cartoonist's loose one.
 */
export const SLOPPINESS = ['architect', 'cartoonist'] as const;

/**
 * What the pen draws with, besides Pizarra's own ink (the default, never stored): a Japanese brush that swells and
 * tapers, a fountain pen, a flat marker, a see-through highlighter, a grainy pencil, chalk, and a glowing neon tube.
 */
export const BRUSHES = ['brush', 'fountain', 'marker', 'highlighter', 'pencil', 'chalk', 'neon'] as const;

/** A shape's corners, when they are not sharp. */
export const EDGES = ['round'] as const;

/** How a fill is drawn, when it is not the hatching every shape gets by default. */
export const FILL_STYLES = ['cross', 'solid'] as const;

/** How opaque an element is, in percent: 100 is never stored. */
export const OPACITIES = [10, 20, 30, 40, 50, 60, 70, 80, 90] as const;

/** How a frame places what is put in it: a column arranges its members top to bottom, the way a kanban lane does. */
export const LAYOUTS = ['column'] as const;

export type Stroke = (typeof STROKES)[number];

export type Fill = (typeof FILLS)[number];

export type StrokeWidth = (typeof STROKE_WIDTHS)[number];

/** A text's size, by the stroke width it is written with — until it is resized, when it keeps a `fontSize` of its own. */
export const FONT_SIZES: Record<StrokeWidth, number> = { 1: 20, 2: 28, 4: 44 };

/** A line of text is this many times its size tall. */
export const LINE_HEIGHT = 1.25;

export type Dash = (typeof DASHES)[number];

export type Sloppiness = (typeof SLOPPINESS)[number];

export type Brush = (typeof BRUSHES)[number];

export type Edges = (typeof EDGES)[number];

export type FillStyle = (typeof FILL_STYLES)[number];

export type Opacity = (typeof OPACITIES)[number];

export type Layout = (typeof LAYOUTS)[number];

export type Point = [number, number];

/**
 * Where on another element a line or an arrow is fixed: the middle of one of its four sides — the connection points
 * every diagramming tool offers, because a connector drawn to "about there" never lines up twice.
 */
export const ANCHORS = ['n', 'e', 's', 'w'] as const;

export type Anchor = (typeof ANCHORS)[number];

/** An answer in a comment's thread: who said it, what, and when. */
export type Reply = { author: string; text: string; at: number };

/** One end of a line, fixed to another element: it follows that element wherever it is moved or resized. */
export type Binding = { id: string; anchor: Anchor };

export type BoardElement = {
  id: string;
  type: ShapeType;
  /** The box, in board units. A line, an arrow or a stroke is its points, relative to `x`/`y`. */
  x: number;
  y: number;
  width: number;
  height: number;
  points?: Point[];
  /** A line's or an arrow's ends, when they are fixed to other elements rather than to a place on the board. */
  start?: Binding;
  end?: Binding;
  /** What is written: a text or a sticky's content, or the label in the middle of a shape. */
  text?: string;
  /** An image's picture, as the id of the asset the server keeps — never the bytes themselves. */
  asset?: string;
  /**
   * Who voted for it, by the id each visitor keeps. Written by the server alone (`board.vote`): a commit carries the
   * element's shape, and the votes on it are whatever the server holds, so two people voting at once both count.
   */
  votes?: string[];
  stroke: Stroke;
  fill: Fill;
  strokeWidth: StrokeWidth;
  /** What makes a hand-drawn line wobble the same way on every screen and every redraw. */
  seed: number;
  /** Stacking order: higher is on top. Brought forward by writing a higher one. */
  z: number;
  /**
   * The group it belongs to: elements sharing one are picked up, moved and stacked as one — a box with what was put
   * inside it. One level: grouping groups makes one group of everything.
   */
  group?: string;
  /** The frame it was put in: it moves with the frame, and a column frame decides where it sits. */
  parent?: string;
  /** A frame's: how it places its members. Absent, they stay wherever they are put. */
  layout?: Layout;
  /** Who wrote a note or a card — a name, as the room knows them. */
  author?: string;
  /** A card's: the task is done. A comment's: it was dealt with. */
  done?: boolean;
  /**
   * A comment's thread, oldest first. Written by the server alone (`board.reply`), as votes are: a commit carries the
   * comment, and the replies on it are whatever the server holds — so two people answering at once are both kept.
   */
  replies?: Reply[];
  /** An outline drawn in dashes or dots rather than one line. */
  dash?: Dash;
  /** How much of a hand shows in its lines — the artist's when absent. */
  sloppiness?: Sloppiness;
  /** A pen stroke's brush — Pizarra's own ink when absent. */
  brush?: Brush;
  /** Round corners — sharp when absent. */
  edges?: Edges;
  /** Cross-hatched or solid — hatched when absent. */
  fillStyle?: FillStyle;
  /** See-through, in percent — opaque when absent. */
  opacity?: Opacity;
  /**
   * Held where it is: selected to be unlocked, but not moved, resized, restyled, written in or deleted — and left out of
   * a marquee and of selecting everything, so a background laid out once is not dragged along by accident.
   */
  locked?: boolean;
  /**
   * A text's size, in board units, once it has been resized by its handles — what its stroke width says (S, M, L)
   * when absent. Only a text has one: every other element's words are sized by what holds them.
   */
  fontSize?: number;
  /**
   * Last write wins, per element: a higher `version` replaces a lower one, and two edits of the same version — two
   * people moving the same shape in the same instant — are settled by the lower `nonce`, the same answer everywhere.
   */
  version: number;
  nonce: number;
  /** Removed, but remembered: a delete is an edit like any other, and must beat the older version it deletes. */
  deleted: boolean;
};

/** How far anything may be drawn from the origin. Beyond it, a number is a mistake or an attack, never a drawing. */
const EXTENT = 1_000_000;

export const LIMITS = {
  /** Points in one stroke. The canvas simplifies a stroke before it commits it, well under this. */
  points: 2000,
  text: 4000,
  /** Elements one commit may carry — a paste, an undo of a big delete. */
  ops: 500,
  /** Elements one board may hold, the removed ones included. */
  elements: 5000,
  /** Votes one element may carry. */
  votes: 500,
  /** An author's name: what a cursor's label shows, no longer. */
  author: 32,
  /** Replies one comment may carry. */
  replies: 100,
  /** A stamp's emoji, in UTF-16 units: enough for a flag or a family, never a sentence. */
  stamp: 16,
  /** A text's size, from the smallest still read to a headline across a board. */
  fontSize: { min: 8, max: 480 }
} as const;

const isFontSize = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= LIMITS.fontSize.min && value <= LIMITS.fontSize.max;

/** An object read from the wire — a message, a document — with its fields to look at. Not a list. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A field read as text: itself when it is one, `fallback` when it is anything else — never `[object Object]`. */
export const textOf = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);

const isCoordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= EXTENT;

const isOneOf = <T extends string | number>(values: readonly T[], value: unknown): value is T =>
  values.some(entry => entry === value);

export const isElementId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{6,32}$/.test(value);

/** An asset's id: long and random, because knowing it is what lets anyone fetch the picture. */
export const isAssetId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{16,32}$/.test(value);

/** The id a visitor keeps across visits, which is what a vote is counted by. */
export const isVoterId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9]{8,24}$/.test(value);

const isPoint = (value: unknown): value is Point =>
  Array.isArray(value) && value.length === 2 && isCoordinate(value[0]) && isCoordinate(value[1]);

const LINEAR = new Set<ShapeType>(['arrow', 'line', 'freehand']);

const WITH_TEXT = new Set<ShapeType>(['text', 'sticky', 'card', 'frame', 'comment']);

const LABELLED = new Set<ShapeType>(['rectangle', 'ellipse', 'diamond', 'triangle', 'hexagon', 'cylinder', 'star']);

/** The lines that can be fixed at their ends. A pen stroke is drawn, not connected. */
const CONNECTORS = new Set<ShapeType>(['arrow', 'line']);

export const isLinear = (type: ShapeType): boolean => LINEAR.has(type);

/** Whether text IS the element — a text, a sticky, a card, a frame's title — rather than something written on it. */
export const holdsText = (type: ShapeType): boolean => WITH_TEXT.has(type);

/** Whether a label can be written in its middle. */
export const takesLabel = (type: ShapeType): boolean => LABELLED.has(type);

export const isConnector = (type: ShapeType): boolean => CONNECTORS.has(type);

/**
 * Whether a connector may be fixed to it: anything with a box — never another line, and never a frame, which is
 * where things are put rather than something to point at.
 */
export const isConnectable = (type: ShapeType): boolean => !LINEAR.has(type) && type !== 'frame' && type !== 'comment';

/** Whether it is written by someone, whose name it keeps: a note, a card, a comment. */
export const isAuthored = (type: ShapeType): boolean => type === 'sticky' || type === 'card' || type === 'comment';

/** Whether it can be ticked off: a card done, a comment resolved. */
export const isTask = (type: ShapeType): boolean => type === 'card' || type === 'comment';

/** Whether it can be put in a frame: anything but another frame, and the lines, which run between things. */
export const fitsInFrame = (type: ShapeType): boolean => type !== 'frame' && !LINEAR.has(type);

export type StyleField =
  'stroke' | 'fill' | 'strokeWidth' | 'dash' | 'sloppiness' | 'edges' | 'fillStyle' | 'opacity' | 'brush';

/**
 * What each kind of element is restyled with — what the style panel offers for it, and all a restyle changes. A text's
 * stroke is its colour and its width its size; a note is its paper; a picture is what it is.
 */
const SHAPE_STYLES: readonly StyleField[] = [
  'stroke',
  'fill',
  'fillStyle',
  'strokeWidth',
  'dash',
  'sloppiness',
  'opacity'
];

/** A shape with corners, which may be rounded. */
const CORNERED: readonly StyleField[] = [...SHAPE_STYLES, 'edges'];

const LINE_STYLES: readonly StyleField[] = ['stroke', 'strokeWidth', 'dash', 'sloppiness', 'opacity'];

const STYLES: Record<ShapeType, readonly StyleField[]> = {
  rectangle: CORNERED,
  ellipse: SHAPE_STYLES,
  diamond: CORNERED,
  triangle: CORNERED,
  hexagon: CORNERED,
  cylinder: SHAPE_STYLES,
  star: SHAPE_STYLES,
  arrow: LINE_STYLES,
  line: LINE_STYLES,
  freehand: ['stroke', 'strokeWidth', 'brush', 'opacity'],
  text: ['stroke', 'strokeWidth', 'opacity'],
  sticky: ['fill', 'opacity'],
  stack: ['fill'],
  image: ['opacity'],
  // A frame's tint, and a card's strip.
  frame: ['fill'],
  card: ['fill', 'opacity'],
  comment: [],
  stamp: ['opacity']
};

export const takesStyle = (type: ShapeType, field: StyleField): boolean => STYLES[type].includes(field);

/**
 * The order elements are drawn in, bottom to top: frames first, whatever their `z` — a frame is where things are put,
 * and one drawn later would cover what is in it — then everything else by `z`.
 */
export const byStacking = (a: BoardElement, b: BoardElement): number =>
  Number(a.type !== 'frame') - Number(b.type !== 'frame') || a.z - b.z || (a.id < b.id ? -1 : 1);

const isReply = (value: unknown): value is Reply =>
  isRecord(value) &&
  typeof value.author === 'string' &&
  value.author.length <= LIMITS.author &&
  typeof value.text === 'string' &&
  value.text.length <= LIMITS.text &&
  typeof value.at === 'number' &&
  Number.isFinite(value.at);

const parseBinding = (value: unknown): Binding | undefined | false => {
  if (value === undefined) {
    return undefined;
  }

  return isRecord(value) && isElementId(value.id) && isOneOf(ANCHORS, value.anchor)
    ? { id: value.id, anchor: value.anchor }
    : false;
};

/**
 * An element from outside, checked field by field — or `undefined`. Rebuilt rather than passed through, so nothing a
 * client added beside the fields above ever reaches the store or another screen.
 */
export const parseElement = (value: unknown): BoardElement | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const {
    id,
    type,
    x,
    y,
    width,
    height,
    points,
    text,
    start,
    end,
    asset,
    votes,
    stroke,
    fill,
    strokeWidth,
    seed,
    z,
    group,
    parent,
    layout,
    author,
    done,
    dash,
    sloppiness,
    brush,
    replies,
    edges,
    fillStyle,
    opacity,
    fontSize,
    locked,
    version,
    nonce,
    deleted
  } = value;
  if (
    !isElementId(id) ||
    !isOneOf(SHAPE_TYPES, type) ||
    !isCoordinate(x) ||
    !isCoordinate(y) ||
    !isCoordinate(width) ||
    !isCoordinate(height) ||
    !isOneOf(STROKES, stroke) ||
    !isOneOf(FILLS, fill) ||
    !isOneOf(STROKE_WIDTHS, strokeWidth) ||
    !Number.isInteger(seed) ||
    !isCoordinate(z) ||
    !Number.isInteger(version) ||
    !Number.isInteger(nonce) ||
    typeof deleted !== 'boolean' ||
    (group !== undefined && !isElementId(group)) ||
    (parent !== undefined && (!isElementId(parent) || parent === id || !fitsInFrame(type))) ||
    (layout !== undefined && (type !== 'frame' || !isOneOf(LAYOUTS, layout))) ||
    (author !== undefined && (typeof author !== 'string' || !isAuthored(type))) ||
    (done !== undefined && (!isTask(type) || typeof done !== 'boolean')) ||
    (replies !== undefined &&
      (type !== 'comment' || !Array.isArray(replies) || replies.length > LIMITS.replies || !replies.every(isReply))) ||
    (dash !== undefined && (!isOneOf(DASHES, dash) || !takesStyle(type, 'dash'))) ||
    (sloppiness !== undefined && (!isOneOf(SLOPPINESS, sloppiness) || !takesStyle(type, 'sloppiness'))) ||
    (edges !== undefined && (!isOneOf(EDGES, edges) || !takesStyle(type, 'edges'))) ||
    (brush !== undefined && (!isOneOf(BRUSHES, brush) || !takesStyle(type, 'brush'))) ||
    (fillStyle !== undefined && (!isOneOf(FILL_STYLES, fillStyle) || !takesStyle(type, 'fillStyle'))) ||
    (opacity !== undefined && (!isOneOf(OPACITIES, opacity) || !takesStyle(type, 'opacity'))) ||
    (fontSize !== undefined && (type !== 'text' || !isFontSize(fontSize))) ||
    (locked !== undefined && typeof locked !== 'boolean') ||
    (type === 'image' && !isAssetId(asset)) ||
    (votes !== undefined && !(Array.isArray(votes) && votes.length <= LIMITS.votes && votes.every(isVoterId)))
  ) {
    return undefined;
  }

  const element: BoardElement = {
    id,
    type,
    x,
    y,
    width: Math.abs(width),
    height: Math.abs(height),
    stroke,
    fill,
    strokeWidth,
    seed: Number(seed),
    z,
    version: Number(version),
    nonce: Number(nonce),
    deleted,
    ...(group === undefined ? {} : { group }),
    ...(parent === undefined ? {} : { parent }),
    ...(layout === undefined ? {} : { layout }),
    ...(typeof author === 'string' && author.trim() ? { author: author.trim().slice(0, LIMITS.author) } : {}),
    ...(done === true ? { done } : {}),
    ...(dash === undefined ? {} : { dash }),
    ...(sloppiness === undefined ? {} : { sloppiness }),
    ...(edges === undefined ? {} : { edges }),
    ...(brush === undefined ? {} : { brush }),
    ...(Array.isArray(replies) && replies.length
      ? { replies: replies.filter(isReply).map(({ author, text, at }) => ({ author, text, at })) }
      : {}),
    ...(fillStyle === undefined ? {} : { fillStyle }),
    ...(opacity === undefined ? {} : { opacity }),
    ...(isFontSize(fontSize) ? { fontSize: Math.round(fontSize) } : {}),
    ...(locked === true ? { locked } : {}),
    ...(type === 'image' && isAssetId(asset) ? { asset } : {}),
    ...(Array.isArray(votes) && votes.length ? { votes: [...new Set(votes.filter(isVoterId))] } : {})
  };

  if (isLinear(type)) {
    if (!Array.isArray(points) || points.length < 2 || points.length > LIMITS.points || !points.every(isPoint)) {
      return undefined;
    }

    element.points = points.map(([px, py]) => [px, py]);
  }

  // A stamp's text is its emoji: one grapheme, or the few code points a composed one is written with.
  if (type === 'stamp' && (typeof text !== 'string' || !text || text.length > LIMITS.stamp)) {
    return undefined;
  }

  if (holdsText(type) || type === 'stamp' || (takesLabel(type) && text !== undefined)) {
    if (typeof text !== 'string' || text.length > LIMITS.text) {
      return undefined;
    }

    element.text = text;
  }

  if (isConnector(type)) {
    const [first, last] = [parseBinding(start), parseBinding(end)];
    if (first === false || last === false) {
      return undefined;
    }

    Object.assign(element, first ? { start: first } : {}, last ? { end: last } : {});
  }

  return element;
};

/** Whether `incoming` replaces `current` — the one rule every screen and the server apply, so all of them agree. */
export const supersedes = (incoming: BoardElement, current: BoardElement | undefined): boolean =>
  !current ||
  incoming.version > current.version ||
  (incoming.version === current.version && incoming.nonce < current.nonce);

/**
 * Merges elements into a board, element by element, and answers what each one touched now IS — the incoming version
 * where it won, the kept one where it lost. Sent back to everyone, that answer is what makes a losing screen converge
 * instead of drawing its own version until the next reload.
 */
export const mergeElements = (
  board: Record<string, BoardElement>,
  incoming: readonly BoardElement[]
): { board: Record<string, BoardElement>; settled: BoardElement[] } => {
  const next = { ...board };
  const touched = new Set<string>();
  for (const element of incoming) {
    if (supersedes(element, next[element.id])) {
      next[element.id] = element;
    }

    touched.add(element.id);
  }

  return { board: next, settled: [...touched].map(id => next[id]) };
};

/** Board ids are what a link carries: short, unambiguous when read aloud, and not guessable in bulk. */
export const isBoardId = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9]{10}$/.test(value);

/** How long a board lasts, in hours — `0` is for good. */
export const LIFETIMES = [0, 1, 5, 24, 168] as const;

/** What a board made temporary lasts when nobody said how long: a day — a session, and nothing left behind. */
export const DEFAULT_LIFETIME = 24;

export const TITLE_LIMIT = 80;

/** The title a person typed, made safe to keep and to show: one line, trimmed, and never empty. */
export const cleanTitle = (value: unknown): string => {
  const title = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, TITLE_LIMIT) : '';

  return title || 'Untitled board';
};
