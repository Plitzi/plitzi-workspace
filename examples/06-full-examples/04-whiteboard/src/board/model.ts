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
  'arrow',
  'line',
  'freehand',
  'text',
  'sticky',
  /** A pile of sticky notes on the board: anyone drags a fresh note off it, in its paper. */
  'stack',
  /** A picture someone pasted or dropped: the image itself is an asset the server keeps beside the board. */
  'image'
] as const;

export type ShapeType = (typeof SHAPE_TYPES)[number];

/**
 * The colours, by NAME. A board stores `ink`, never `#16201c`: the canvas resolves each name from the page's own custom
 * properties, so the same drawing is dark ink on paper in the light scheme and chalk on slate in the dark one.
 */
export const STROKES = ['ink', 'red', 'orange', 'green', 'blue', 'violet'] as const;

export const FILLS = ['none', 'red', 'orange', 'yellow', 'green', 'blue', 'violet'] as const;

export const STROKE_WIDTHS = [1, 2, 4] as const;

export type Stroke = (typeof STROKES)[number];

export type Fill = (typeof FILLS)[number];

export type StrokeWidth = (typeof STROKE_WIDTHS)[number];

export type Point = [number, number];

/**
 * Where on another element a line or an arrow is fixed: the middle of one of its four sides — the connection points
 * every diagramming tool offers, because a connector drawn to "about there" never lines up twice.
 */
export const ANCHORS = ['n', 'e', 's', 'w'] as const;

export type Anchor = (typeof ANCHORS)[number];

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
  votes: 500
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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

const WITH_TEXT = new Set<ShapeType>(['text', 'sticky']);

const LABELLED = new Set<ShapeType>(['rectangle', 'ellipse', 'diamond']);

/** The lines that can be fixed at their ends. A pen stroke is drawn, not connected. */
const CONNECTORS = new Set<ShapeType>(['arrow', 'line']);

export const isLinear = (type: ShapeType): boolean => LINEAR.has(type);

/** Whether text IS the element — a text, a sticky — rather than something written on it. */
export const holdsText = (type: ShapeType): boolean => WITH_TEXT.has(type);

/** Whether a label can be written in its middle. */
export const takesLabel = (type: ShapeType): boolean => LABELLED.has(type);

export const isConnector = (type: ShapeType): boolean => CONNECTORS.has(type);

/** Whether a connector may be fixed to it: anything with a box — never another line. */
export const isConnectable = (type: ShapeType): boolean => !LINEAR.has(type);

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
    ...(type === 'image' && isAssetId(asset) ? { asset } : {}),
    ...(Array.isArray(votes) && votes.length ? { votes: [...new Set(votes.filter(isVoterId))] } : {})
  };

  if (isLinear(type)) {
    if (!Array.isArray(points) || points.length < 2 || points.length > LIMITS.points || !points.every(isPoint)) {
      return undefined;
    }

    element.points = points.map(([px, py]) => [px, py]);
  }

  if (holdsText(type) || (takesLabel(type) && text !== undefined)) {
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

export const TITLE_LIMIT = 80;

/** The title a person typed, made safe to keep and to show: one line, trimmed, and never empty. */
export const cleanTitle = (value: unknown): string => {
  const title = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, TITLE_LIMIT) : '';

  return title || 'Untitled board';
};
