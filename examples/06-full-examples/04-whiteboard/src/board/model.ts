/**
 * What a board is made of — one file, read by the browser that draws it and by the server that keeps it.
 *
 * Both halves import THIS, so the shape a canvas commits and the shape the server accepts cannot drift apart: a field
 * added here is drawn, validated and merged by the same definition.
 */

export const SHAPE_TYPES = ['rectangle', 'ellipse', 'diamond', 'arrow', 'line', 'freehand', 'text', 'sticky'] as const;

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

export type BoardElement = {
  id: string;
  type: ShapeType;
  /** The box, in board units. A line, an arrow or a stroke is its points, relative to `x`/`y`. */
  x: number;
  y: number;
  width: number;
  height: number;
  points?: Point[];
  text?: string;
  stroke: Stroke;
  fill: Fill;
  strokeWidth: StrokeWidth;
  /** What makes a hand-drawn line wobble the same way on every screen and every redraw. */
  seed: number;
  /** Stacking order: higher is on top. Brought forward by writing a higher one. */
  z: number;
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
  elements: 5000
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCoordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= EXTENT;

const isOneOf = <T extends string | number>(values: readonly T[], value: unknown): value is T =>
  values.some(entry => entry === value);

export const isElementId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{6,32}$/.test(value);

const isPoint = (value: unknown): value is Point =>
  Array.isArray(value) && value.length === 2 && isCoordinate(value[0]) && isCoordinate(value[1]);

const LINEAR = new Set<ShapeType>(['arrow', 'line', 'freehand']);

const WITH_TEXT = new Set<ShapeType>(['text', 'sticky']);

export const isLinear = (type: ShapeType): boolean => LINEAR.has(type);

export const holdsText = (type: ShapeType): boolean => WITH_TEXT.has(type);

/**
 * An element from outside, checked field by field — or `undefined`. Rebuilt rather than passed through, so nothing a
 * client added beside the fields above ever reaches the store or another screen.
 */
export const parseElement = (value: unknown): BoardElement | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const { id, type, x, y, width, height, points, text, stroke, fill, strokeWidth, seed, z, version, nonce, deleted } =
    value;
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
    typeof deleted !== 'boolean'
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
    deleted
  };

  if (isLinear(type)) {
    if (!Array.isArray(points) || points.length < 2 || points.length > LIMITS.points || !points.every(isPoint)) {
      return undefined;
    }

    element.points = points.map(([px, py]) => [px, py]);
  }

  if (holdsText(type)) {
    if (typeof text !== 'string' || text.length > LIMITS.text) {
      return undefined;
    }

    element.text = text;
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
