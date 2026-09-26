import { randomInt } from 'node:crypto';

import { fitsInFrame } from './model.ts';

import type {
  Anchor,
  BoardElement,
  Brush,
  Dash,
  Edges,
  Fill,
  FillStyle,
  Layout,
  Opacity,
  Point,
  Reply,
  ShapeType,
  Sloppiness,
  Stroke,
  StrokeWidth
} from './model.ts';

/**
 * Drawing a board in code: what the templates and the featured boards are written with. Nothing here is more than a
 * person could draw — every element is an ordinary one, stamped as its first version.
 */

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export const newId = (): string =>
  Array.from({ length: 12 }, () => ID_ALPHABET[randomInt(ID_ALPHABET.length)]).join('');

export type Draft = {
  /** Given when something else names it — a connector's end; made up otherwise. */
  id?: string;
  type: ShapeType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  stroke?: Stroke;
  fill?: Fill;
  points?: Point[];
  start?: { id: string; anchor: Anchor };
  end?: { id: string; anchor: Anchor };
  strokeWidth?: StrokeWidth;
  group?: string;
  parent?: string;
  layout?: Layout;
  author?: string;
  done?: boolean;
  dash?: Dash;
  sloppiness?: Sloppiness;
  edges?: Edges;
  fillStyle?: FillStyle;
  opacity?: Opacity;
  brush?: Brush;
  fontSize?: number;
  replies?: Reply[];
  votes?: string[];
};

/** The fields a draft may carry beyond its box, copied as they are — only those it names. */
const OPTIONAL = [
  'group',
  'parent',
  'layout',
  'author',
  'done',
  'dash',
  'sloppiness',
  'edges',
  'fillStyle',
  'opacity',
  'brush',
  'fontSize',
  'replies',
  'votes'
] as const;

/** A template's elements, stacked in the order written and stamped as the first version of each. */
export const drawing = (drafts: readonly Draft[]): BoardElement[] =>
  drafts.map((draft, index) => ({
    id: draft.id ?? newId(),
    type: draft.type,
    x: draft.x,
    y: draft.y,
    width: draft.width ?? 0,
    height: draft.height ?? 0,
    stroke: draft.stroke ?? 'ink',
    fill: draft.fill ?? 'none',
    strokeWidth: draft.strokeWidth ?? 2,
    seed: randomInt(2 ** 31),
    z: index + 1,
    version: 1,
    nonce: randomInt(2 ** 31),
    deleted: false,
    ...(draft.points ? { points: draft.points } : {}),
    ...(draft.text === undefined ? {} : { text: draft.text }),
    ...(draft.start ? { start: draft.start } : {}),
    ...(draft.end ? { end: draft.end } : {}),
    ...Object.fromEntries(OPTIONAL.flatMap(key => (draft[key] === undefined ? [] : [[key, draft[key]]])))
  }));

/**
 * A hand-drawn stroke through the given points, as the pen would have made it: points every few units along the way,
 * with the small wander a hand has — seeded, so the same board is drawn the same way every time.
 */
export const scribble = (points: readonly Point[], stroke: Stroke = 'ink', seed = 1): Draft => {
  let state = seed;
  const wander = (): number => {
    state = (state * 16807) % 2147483647;

    return ((state % 1000) / 1000 - 0.5) * 2.4;
  };
  const traced: Point[] = [];
  points.forEach((point, index) => {
    const next = points[index + 1];
    if (!next) {
      traced.push(point);

      return;
    }

    const steps = Math.max(2, Math.round(Math.hypot(next[0] - point[0], next[1] - point[1]) / 6));
    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;
      traced.push([point[0] + (next[0] - point[0]) * t + wander(), point[1] + (next[1] - point[1]) * t + wander()]);
    }
  });
  const [x, y] = traced[0];

  return {
    type: 'freehand',
    x,
    y,
    stroke,
    points: traced.map(([px, py]) => [px - x, py - y])
  };
};

/** A hand-drawn loop around a box: what someone circles to say "this one". */
export const loop = (x: number, y: number, width: number, height: number, stroke: Stroke = 'red', seed = 7): Draft => {
  const around: Point[] = Array.from({ length: 37 }, (_, index) => {
    const angle = (index / 36) * Math.PI * 2.1 - Math.PI / 2;

    return [x + width / 2 + Math.cos(angle) * width * 0.56, y + height / 2 + Math.sin(angle) * height * 0.62];
  });

  return scribble(around, stroke, seed);
};

export const sticky = (x: number, y: number, text: string, fill: Fill = 'yellow'): Draft => ({
  type: 'sticky',
  x,
  y,
  width: 200,
  height: 200,
  fill,
  text
});

/** A connector from one element's anchor to another's: its points are redrawn from them the moment it is shown. */
export const connect = (from: string, fromAnchor: Anchor, to: string, toAnchor: Anchor): Draft => ({
  type: 'arrow',
  x: 0,
  y: 0,
  points: [
    [0, 0],
    [1, 1]
  ],
  start: { id: from, anchor: fromAnchor },
  end: { id: to, anchor: toAnchor }
});

/** A frame's title bar, and the room a column leaves around and between what it holds — as the canvas lays them. */
const FRAME_HEADER = 48;

const COLUMN_PADDING = 14;

const COLUMN_GAP = 12;

/**
 * How tall a card is with these words at this width, as the canvas measures it: its lines, wrapped, and the row for
 * who wrote it. An estimate — Node has no canvas to measure with — close enough that a column drawn here needs no
 * laying out again when it is first shown.
 */
export const estimatedCardHeight = (text: string, width: number, author: boolean): number => {
  const perLine = Math.max(8, Math.floor((width - 56) / 8.2));
  const lines = text
    .split('\n')
    .reduce((total, paragraph) => total + Math.max(1, Math.ceil(paragraph.length / perLine)), 0);

  return Math.max(46, 28 + lines * 20 + (author ? 26 : 0));
};

/** A task card: its words, a colour strip, who wrote it, and whether it is done. */
export const card = (
  text: string,
  {
    fill = 'none',
    done = false,
    author,
    width = 260
  }: { fill?: Fill; done?: boolean; author?: string; width?: number } = {}
): Draft => ({
  type: 'card',
  x: 0,
  y: 0,
  width,
  height: estimatedCardHeight(text, width, author !== undefined),
  text,
  fill,
  ...(done ? { done } : {}),
  ...(author ? { author } : {})
});

/** Feedback pinned to a place, with its thread. */
export const comment = (
  x: number,
  y: number,
  text: string,
  author: string,
  replies: [string, string][] = []
): Draft => ({
  type: 'comment',
  x,
  y,
  width: 32,
  height: 32,
  text,
  author,
  ...(replies.length
    ? { replies: replies.map(([by, said], index) => ({ author: by, text: said, at: index + 1 })) }
    : {})
});

/**
 * A kanban lane: a column frame, and what is in it stacked top to bottom as the canvas stacks it — cards as wide as
 * the column, anything else centred. The column is as tall as it needs to be, and never shorter than `height`.
 */
export const column = (
  {
    x,
    y,
    width = 300,
    height = 460,
    title,
    fill = 'none'
  }: { x: number; y: number; width?: number; height?: number; title: string; fill?: Fill },
  items: readonly Draft[]
): Draft[] => {
  const id = newId();
  let top = y + FRAME_HEADER + COLUMN_PADDING;
  const placed = items.map(item => {
    const itemWidth = item.type === 'card' ? width - COLUMN_PADDING * 2 : (item.width ?? 200);
    const itemHeight =
      item.type === 'card'
        ? estimatedCardHeight(item.text ?? '', itemWidth, item.author !== undefined)
        : (item.height ?? 200);
    const next: Draft = {
      ...item,
      x: item.type === 'card' ? x + COLUMN_PADDING : x + (width - itemWidth) / 2,
      y: top,
      width: itemWidth,
      height: itemHeight,
      parent: id
    };
    top += itemHeight + COLUMN_GAP;

    return next;
  });

  return [
    {
      id,
      type: 'frame',
      x,
      y,
      width,
      height: Math.max(height, top - COLUMN_GAP + COLUMN_PADDING - y),
      text: title,
      fill,
      layout: 'column'
    },
    ...placed
  ];
};

/** A free frame — a section of a board — and what is in it, placed where it is written. */
export const section = (
  {
    x,
    y,
    width,
    height,
    title,
    fill = 'none'
  }: { x: number; y: number; width: number; height: number; title: string; fill?: Fill },
  items: readonly Draft[]
): Draft[] => {
  const id = newId();

  // Only what can be in a frame is: a line runs between things, and lies over the frame without belonging to it.
  return [
    { id, type: 'frame', x, y, width, height, text: title, fill },
    ...items.map(item => (fitsInFrame(item.type) ? { ...item, parent: id } : item))
  ];
};
