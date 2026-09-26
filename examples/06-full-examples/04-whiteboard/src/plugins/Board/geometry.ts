import { ANCHORS, LIMITS, isConnectable, isLinear } from '../../board/model.ts';
import { inkRadius } from './pens.ts';
import { insidePolygon, outlineOf, rayExit } from './shapes.ts';

import type { Anchor, Binding, BoardElement, Point } from '../../board/model.ts';

/** Where the canvas looks: the board point at its top-left corner, and how many screen pixels a board unit is. */
export type Camera = { x: number; y: number; zoom: number };

export type Box = { x: number; y: number; width: number; height: number };

/** A frame's title bar, in board units: where it is picked up — the rest of it is where things are put. */
export const FRAME_HEADER = 48;

export const MIN_ZOOM = 0.1;

export const MAX_ZOOM = 8;

export const clampZoom = (zoom: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

export const toBoard = (camera: Camera, screenX: number, screenY: number): Point => [
  screenX / camera.zoom + camera.x,
  screenY / camera.zoom + camera.y
];

export const toScreen = (camera: Camera, boardX: number, boardY: number): Point => [
  (boardX - camera.x) * camera.zoom,
  (boardY - camera.y) * camera.zoom
];

/** Zooms about a screen point, which stays over the same board point — what a pinch or a wheel under a cursor means. */
export const zoomAt = (camera: Camera, screenX: number, screenY: number, zoom: number): Camera => {
  const next = clampZoom(zoom);
  const [boardX, boardY] = toBoard(camera, screenX, screenY);

  return { x: boardX - screenX / next, y: boardY - screenY / next, zoom: next };
};

/** The camera that shows `box` whole in a `width`×`height` view, with a margin, never closer than 1:1. */
export const fitCamera = (box: Box, width: number, height: number, margin = 48): Camera => {
  const zoom = clampZoom(
    Math.min(1, (width - margin * 2) / Math.max(box.width, 1), (height - margin * 2) / Math.max(box.height, 1))
  );

  return {
    x: box.x + box.width / 2 - width / 2 / zoom,
    y: box.y + box.height / 2 - height / 2 / zoom,
    zoom
  };
};

/** A box from two corners, in any order. */
export const boxFrom = ([ax, ay]: Point, [bx, by]: Point): Box => ({
  x: Math.min(ax, bx),
  y: Math.min(ay, by),
  width: Math.abs(bx - ax),
  height: Math.abs(by - ay)
});

/** The points of a line, an arrow or a stroke, on the board rather than relative to the element. */
export const absolutePoints = (element: BoardElement): Point[] =>
  (element.points ?? []).map(([px, py]) => [element.x + px, element.y + py]);

/**
 * Worked out once per element: an element is never changed in place — every edit is a new version, a new object —
 * so its box is the same for as long as the object is. Every frame, every hit test and every marquee step asks for the
 * box of every element on the board, and a stroke's is a walk over all its points.
 */
const boxes = new WeakMap<BoardElement, Box>();

export const boundsOf = (element: BoardElement): Box => {
  const known = boxes.get(element);
  if (known) {
    return known;
  }

  const box = measureBounds(element);
  boxes.set(element, box);

  return box;
};

/**
 * An element moved by `dx`, `dy`, with its box moved with it: a drag makes a new copy of everything it carries at every
 * step, and measuring each copy again — a stroke point by point — was most of what a big drag cost.
 */
export const movedBy = (element: BoardElement, dx: number, dy: number): BoardElement => {
  const moved = { ...element, x: element.x + dx, y: element.y + dy };
  const box = boundsOf(element);
  boxes.set(moved, { ...box, x: box.x + dx, y: box.y + dy });
  const prior = shiftOf(element);
  shifts.set(moved, { from: prior.from, dx: prior.dx + dx, dy: prior.dy + dy });

  return moved;
};

/** An element as a copy of another moved: the one it was first copied from, and how far it has moved since. */
export type Shift = { from: BoardElement; dx: number; dy: number };

const shifts = new WeakMap<BoardElement, Shift>();

/** How an element came to be: moved from another by {@link movedBy}, or — `dx`, `dy` of 0 — itself. */
export const shiftOf = (element: BoardElement): Shift => shifts.get(element) ?? { from: element, dx: 0, dy: 0 };

const measureBounds = (element: BoardElement): Box => {
  if (!isLinear(element.type) || !element.points?.length) {
    return { x: element.x, y: element.y, width: element.width, height: element.height };
  }

  // Out to where the ink reaches, not only the line through the points: a wide stroke is outlined around its ink.
  const reach = inkRadius(element);
  let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [px, py] of element.points) {
    left = Math.min(left, element.x + px);
    top = Math.min(top, element.y + py);
    right = Math.max(right, element.x + px);
    bottom = Math.max(bottom, element.y + py);
  }

  return {
    x: left - reach,
    y: top - reach,
    width: right + reach - (left - reach),
    height: bottom + reach - (top - reach)
  };
};

export const unionOf = (boxes: readonly Box[]): Box | undefined => {
  if (!boxes.length) {
    return undefined;
  }

  const x = Math.min(...boxes.map(box => box.x));
  const y = Math.min(...boxes.map(box => box.y));
  const right = Math.max(...boxes.map(box => box.x + box.width));
  const bottom = Math.max(...boxes.map(box => box.y + box.height));

  return { x, y, width: right - x, height: bottom - y };
};

export const contains = (outer: Box, inner: Box): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

const distanceToSegment = ([px, py]: Point, [ax, ay]: Point, [bx, by]: Point): number => {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length));

  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

const nearPolyline = (point: Point, points: readonly Point[], tolerance: number): boolean =>
  points.some((start, index) => index > 0 && distanceToSegment(point, points[index - 1], start) <= tolerance);

/** Whether a board point touches an element: its outline, or anywhere inside it once it is filled. */
export const hits = (element: BoardElement, point: Point, tolerance: number): boolean => {
  if (isLinear(element.type)) {
    return nearPolyline(point, absolutePoints(element), tolerance + inkRadius(element));
  }

  const reach = tolerance + element.strokeWidth;

  const [px, py] = point;
  const { x, y, width, height } = element;
  if (element.type === 'frame') {
    // By its title bar or its edge: inside it is the board, where things are put, selected and drawn.
    const across = px >= x - reach && px <= x + width + reach;
    const header = across && py >= y - reach && py <= y + FRAME_HEADER;
    const within = across && py >= y - reach && py <= y + height + reach;
    const edge =
      within &&
      (Math.abs(px - x) <= reach ||
        Math.abs(px - x - width) <= reach ||
        Math.abs(py - y) <= reach ||
        Math.abs(py - y - height) <= reach);

    return header || edge;
  }

  // Paper, cards, pictures and stamps are solid whatever their fill: each is picked up anywhere on it.
  const solid =
    element.fill !== 'none' || ['text', 'sticky', 'stack', 'image', 'card', 'comment', 'stamp'].includes(element.type);

  if (element.type === 'ellipse') {
    const rx = Math.max(width / 2, 1);
    const ry = Math.max(height / 2, 1);
    const distance = Math.hypot((px - x - rx) / rx, (py - y - ry) / ry);

    return solid ? distance <= 1 + reach / Math.min(rx, ry) : Math.abs(distance - 1) * Math.min(rx, ry) <= reach;
  }

  const outline = outlineOf(element.type, width, height);
  if (outline) {
    const corners: Point[] = [...outline, outline[0]].map(([cx, cy]) => [x + cx, y + cy]);

    return (solid && insidePolygon([px - x, py - y], outline)) || nearPolyline(point, corners, reach);
  }

  const inside = px >= x - reach && px <= x + width + reach && py >= y - reach && py <= y + height + reach;
  if (solid || !inside) {
    return inside;
  }

  return (
    Math.abs(px - x) <= reach ||
    Math.abs(px - x - width) <= reach ||
    Math.abs(py - y) <= reach ||
    Math.abs(py - y - height) <= reach
  );
};

export type Handle = 'nw' | 'ne' | 'se' | 'sw';

export const HANDLES: readonly Handle[] = ['nw', 'ne', 'se', 'sw'];

/** Where a selection's corner handle is, on the board. */
export const handlePoint = (box: Box, handle: Handle): Point => [
  handle === 'nw' || handle === 'sw' ? box.x : box.x + box.width,
  handle === 'nw' || handle === 'ne' ? box.y : box.y + box.height
];

/** The corner opposite a handle: what stays put while that handle is dragged. */
export const anchorOf = (box: Box, handle: Handle): Point =>
  handlePoint(box, ({ nw: 'se', ne: 'sw', se: 'nw', sw: 'ne' } as const)[handle]);

/**
 * An element scaled about an anchor. A line's points scale with its box; text keeps its size and only moves, because
 * a font size dragged to 3.7 times is not a size anybody chose.
 */
/** `size` is the element's font size as drawn — what a text's resize scales. */
export const scaleElement = (
  element: BoardElement,
  [ax, ay]: Point,
  scaleX: number,
  scaleY: number,
  size: number
): BoardElement => {
  // A text is resized by its size: the words grow or shrink as one, by whichever way the handle went furthest.
  if (element.type === 'text') {
    const factor =
      Math.abs(Math.abs(scaleX) - 1) > Math.abs(Math.abs(scaleY) - 1) ? Math.abs(scaleX) : Math.abs(scaleY);
    const fontSize = Math.min(LIMITS.fontSize.max, Math.max(LIMITS.fontSize.min, Math.round(size * factor)));
    const applied = fontSize / size;

    return {
      ...element,
      x: ax + (element.x - ax) * applied,
      y: ay + (element.y - ay) * applied,
      width: element.width * applied,
      height: element.height * applied,
      fontSize
    };
  }

  // A stamp stays square — its emoji fills it, and a stretched box would only be empty on two sides: the same scale
  // both ways, the largest the handle asked for, each way keeping the direction it was dragged in.
  if (element.type === 'stamp') {
    const factor = Math.max(Math.abs(scaleX), Math.abs(scaleY));

    return {
      ...element,
      ...scaledBox(element, [ax, ay], Math.sign(scaleX || 1) * factor, Math.sign(scaleY || 1) * factor)
    };
  }

  const x = ax + (element.x - ax) * scaleX;
  const y = ay + (element.y - ay) * scaleY;
  if (isLinear(element.type) && element.points) {
    const points: Point[] = element.points.map(([px, py]) => [px * scaleX, py * scaleY]);

    return {
      ...element,
      x,
      y,
      points,
      width: element.width * Math.abs(scaleX),
      height: element.height * Math.abs(scaleY)
    };
  }

  return { ...element, ...scaledBox(element, [ax, ay], scaleX, scaleY) };
};

/** A box scaled about an anchor. Flipped by dragging a corner past it, it is the same box, drawn from its other corner. */
const scaledBox = (element: Box, [ax, ay]: Point, scaleX: number, scaleY: number): Box => {
  const x = ax + (element.x - ax) * scaleX;
  const y = ay + (element.y - ay) * scaleY;
  const right = x + element.width * scaleX;
  const bottom = y + element.height * scaleY;

  return { x: Math.min(x, right), y: Math.min(y, bottom), width: Math.abs(right - x), height: Math.abs(bottom - y) };
};

/**
 * At most `max` points, taken evenly along the stroke — and the stroke untouched when it is within that.
 *
 * Never simplified further: the pen's width is simulated from how far apart its points are, so a stroke with points
 * dropped is drawn thicker or thinner than the one the person watched themselves draw.
 */
export const capPoints = (points: readonly Point[], max: number): Point[] => {
  if (points.length <= max) {
    return [...points];
  }

  const step = (points.length - 1) / (max - 1);

  return Array.from({ length: max }, (_, index) => points[Math.round(index * step)]);
};

/** A direction snapped to the nearest 15°, keeping its length — what holding Shift does to a line. */
export const snapAngle = ([dx, dy]: Point): Point => {
  const step = Math.PI / 12;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  const length = Math.hypot(dx, dy);

  return [Math.cos(angle) * length, Math.sin(angle) * length];
};

/** Which way each anchor faces: a connector leaves an element outwards, never back across it. */
const NORMALS: Record<Anchor, Point> = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };

/** How far a connector stops short of the element it is fixed to: touching, a stroke overlaps the outline. */
const ANCHOR_GAP = 6;

/** How many segments a curved connector is drawn, hit and bounded as. */
const CURVE_STEPS = 24;

/**
 * Where a side's connector meets an element: the middle of that side of its box — which is where an ellipse or a
 * diamond meets it too — or, for a convex shape that does not reach its box there (a triangle's sides, a hexagon's),
 * the point of its outline straight out from its middle that way.
 */
export const anchorPoint = (element: BoardElement, anchor: Anchor): Point => {
  const { x, y, width, height } = boundsOf(element);
  // Only a convex outline is met from its middle: a star's notches would take a connector in between its arms, so a
  // star is met at its box, like a rectangle.
  const outline = element.type === 'star' ? undefined : outlineOf(element.type, width, height);
  const exit = outline ? rayExit([width / 2, height / 2], NORMALS[anchor], outline) : undefined;
  if (exit) {
    return [x + exit[0], y + exit[1]];
  }

  const points: Record<Anchor, Point> = {
    n: [x + width / 2, y],
    e: [x + width, y + height / 2],
    s: [x + width / 2, y + height],
    w: [x, y + height / 2]
  };

  return points[anchor];
};

export const anchorPoints = (element: BoardElement): { anchor: Anchor; point: Point }[] =>
  ANCHORS.map(anchor => ({ anchor, point: anchorPoint(element, anchor) }));

/**
 * The anchor a point near an element snaps to: the closest of its four, once the point is over the element or
 * within `reach` of its box. `undefined` for a point nowhere near it.
 */
export const snapToAnchor = (
  element: BoardElement,
  point: Point,
  reach: number,
  toward?: Point
): Binding | undefined => {
  if (!isConnectable(element.type) || element.deleted) {
    return undefined;
  }

  const box = boundsOf(element);
  const near =
    point[0] >= box.x - reach &&
    point[0] <= box.x + box.width + reach &&
    point[1] >= box.y - reach &&
    point[1] <= box.y + box.height + reach;
  if (!near) {
    return undefined;
  }

  // Deep inside the shape, the pointer is choosing the SHAPE, not a side of it: the side facing the other end is the
  // one a person means. Near an edge, it is choosing that edge.
  const aim = toward && isDeepInside(element, point, reach) ? toward : point;

  return { id: element.id, anchor: nearestAnchor(element, aim) };
};

/** Whether a point is inside an element's box and further than `margin` from each of its edges. */
export const isDeepInside = (element: BoardElement, [x, y]: Point, margin: number): boolean => {
  const box = boundsOf(element);

  return x > box.x + margin && x < box.x + box.width - margin && y > box.y + margin && y < box.y + box.height - margin;
};

/** The anchor of an element closest to a point — the side that faces it. */
export const nearestAnchor = (element: BoardElement, point: Point): Anchor => {
  const [closest] = anchorPoints(element).sort(
    (a, b) =>
      Math.hypot(a.point[0] - point[0], a.point[1] - point[1]) -
      Math.hypot(b.point[0] - point[0], b.point[1] - point[1])
  );

  return closest.anchor;
};

const cubic = (p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point => {
  const u = 1 - t;

  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
  ];
};

/**
 * A connector as it is right now: each fixed end at its element's anchor, wherever that element is — and, when an
 * end is fixed, the line bent into a curve that leaves each anchor straight out of its side, the way a diagramming
 * tool routes one. Resolved every time it is drawn, so a connector can never be left pointing at where a shape used
 * to be, on any screen, whoever moved it.
 *
 * An end whose element is gone stays where it was last drawn. The result is an ordinary line — its points are the
 * curve — so hit testing, bounds and drawing need to know nothing about any of this.
 */
export const resolveConnector = (
  element: BoardElement,
  find: (id: string) => BoardElement | undefined
): BoardElement => {
  const absolute = absolutePoints(element);
  if ((!element.start && !element.end) || absolute.length < 2) {
    return element;
  }

  const endOf = (binding: Binding | undefined, fallback: Point): { point: Point; normal?: Point } => {
    const target = binding ? find(binding.id) : undefined;
    if (!binding || !target || target.deleted) {
      return { point: fallback };
    }

    const [ax, ay] = anchorPoint(target, binding.anchor);
    const normal = NORMALS[binding.anchor];

    return { point: [ax + normal[0] * ANCHOR_GAP, ay + normal[1] * ANCHOR_GAP], normal };
  };

  const from = endOf(element.start, absolute[0]);
  const to = endOf(element.end, absolute[absolute.length - 1]);
  const length = Math.hypot(to.point[0] - from.point[0], to.point[1] - from.point[1]);
  const pull = Math.min(160, Math.max(24, length * 0.45));
  const control = (end: { point: Point; normal?: Point }): Point =>
    end.normal ? [end.point[0] + end.normal[0] * pull, end.point[1] + end.normal[1] * pull] : end.point;
  const [c1, c2] = [control(from), control(to)];
  const curve = Array.from({ length: CURVE_STEPS + 1 }, (_, index) =>
    cubic(from.point, c1, c2, to.point, index / CURVE_STEPS)
  );
  const [x, y] = from.point;
  const points: Point[] = curve.map(([px, py]) => [px - x, py - y]);
  const xs = points.map(([px]) => px);
  const ys = points.map(([, py]) => py);

  return {
    ...element,
    x,
    y,
    points,
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
  };
};

/** A connector with one end let go: fixed where it is drawn now, and no longer following anything. */
export const detachEnd = (resolved: BoardElement, end: 'start' | 'end'): BoardElement => {
  const { [end]: _released, ...rest } = resolved;

  return rest;
};

/** A point `distance` outward from one of an element's anchors: where a connection handle sits, just off the edge. */
export const beyondAnchor = (element: BoardElement, anchor: Anchor, distance: number): Point => {
  const [x, y] = anchorPoint(element, anchor);
  const [nx, ny] = NORMALS[anchor];

  return [x + nx * distance, y + ny * distance];
};
