import { randomInt } from 'node:crypto';

import type { Anchor, BoardElement, Fill, Point, ShapeType, Stroke, StrokeWidth } from './model.ts';

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
};

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
    ...(draft.group ? { group: draft.group } : {})
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
