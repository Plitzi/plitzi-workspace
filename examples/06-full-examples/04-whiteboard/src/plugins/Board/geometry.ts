import { isLinear } from '../../board/model.ts';

import type { BoardElement, Point } from '../../board/model.ts';

/** Where the canvas looks: the board point at its top-left corner, and how many screen pixels a board unit is. */
export type Camera = { x: number; y: number; zoom: number };

export type Box = { x: number; y: number; width: number; height: number };

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

export const boundsOf = (element: BoardElement): Box => {
  if (!isLinear(element.type) || !element.points?.length) {
    return { x: element.x, y: element.y, width: element.width, height: element.height };
  }

  const xs = element.points.map(([px]) => element.x + px);
  const ys = element.points.map(([, py]) => element.y + py);
  const x = Math.min(...xs);
  const y = Math.min(...ys);

  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
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
  const reach = tolerance + element.strokeWidth;
  if (isLinear(element.type)) {
    return nearPolyline(point, absolutePoints(element), reach);
  }

  const [px, py] = point;
  const { x, y, width, height } = element;
  const solid = element.fill !== 'none' || element.type === 'text' || element.type === 'sticky';

  if (element.type === 'ellipse') {
    const rx = Math.max(width / 2, 1);
    const ry = Math.max(height / 2, 1);
    const distance = Math.hypot((px - x - rx) / rx, (py - y - ry) / ry);

    return solid ? distance <= 1 + reach / Math.min(rx, ry) : Math.abs(distance - 1) * Math.min(rx, ry) <= reach;
  }

  if (element.type === 'diamond') {
    const corners: Point[] = [
      [x + width / 2, y],
      [x + width, y + height / 2],
      [x + width / 2, y + height],
      [x, y + height / 2],
      [x + width / 2, y]
    ];
    const inside = Math.abs(px - x - width / 2) / (width / 2 || 1) + Math.abs(py - y - height / 2) / (height / 2 || 1);

    return (solid && inside <= 1) || nearPolyline(point, corners, reach);
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
export const scaleElement = (element: BoardElement, [ax, ay]: Point, scaleX: number, scaleY: number): BoardElement => {
  if (element.type === 'text') {
    return { ...element, x: ax + (element.x - ax) * scaleX, y: ay + (element.y - ay) * scaleY };
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

  // A box flipped by dragging a corner past its anchor is the same box, drawn from its other corner.
  const right = x + element.width * scaleX;
  const bottom = y + element.height * scaleY;

  return {
    ...element,
    x: Math.min(x, right),
    y: Math.min(y, bottom),
    width: Math.abs(right - x),
    height: Math.abs(bottom - y)
  };
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
