import type { Point, ShapeType } from '../../board/model.ts';

/**
 * The outlines of the shapes that are polygons, in the element's own coordinates: what is drawn, what a click is
 * tested against, and where a connector meets the shape — one definition for all three, so an arrow never stops short
 * of a triangle's side or hits the air beside a star's point.
 */

const star = (width: number, height: number): Point[] =>
  Array.from({ length: 10 }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    const radius = index % 2 === 0 ? 0.5 : 0.21;

    return [width / 2 + Math.cos(angle) * width * radius, height * 0.53 + Math.sin(angle) * height * radius * 1.06];
  });

const OUTLINES: Partial<Record<ShapeType, (width: number, height: number) => Point[]>> = {
  diamond: (width, height) => [
    [width / 2, 0],
    [width, height / 2],
    [width / 2, height],
    [0, height / 2]
  ],
  triangle: (width, height) => [
    [width / 2, 0],
    [width, height],
    [0, height]
  ],
  hexagon: (width, height) => [
    [width * 0.25, 0],
    [width * 0.75, 0],
    [width, height / 2],
    [width * 0.75, height],
    [width * 0.25, height],
    [0, height / 2]
  ],
  star
};

/** A polygon shape's corners, in its own coordinates — `undefined` for a shape that is not one. */
export const outlineOf = (type: ShapeType, width: number, height: number): Point[] | undefined =>
  OUTLINES[type]?.(width, height);

/** Whether a point is inside a polygon — even-odd, so a star's arms count and the air between them does not. */
export const insidePolygon = ([x, y]: Point, polygon: readonly Point[]): boolean => {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const [xi, yi] = polygon[index];
    const [xj, yj] = polygon[previous];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi) {
      inside = !inside;
    }
  }

  return inside;
};

/**
 * Where a ray from `from` in `direction` last leaves a polygon — its outermost edge that way: how a connector's anchor
 * is put on a shape's outline rather than on its box.
 */
export const rayExit = (from: Point, direction: Point, polygon: readonly Point[]): Point | undefined => {
  let farthest: number | undefined;
  for (let index = 0; index < polygon.length; index += 1) {
    const [ax, ay] = polygon[index];
    const [bx, by] = polygon[(index + 1) % polygon.length];
    const [ex, ey] = [bx - ax, by - ay];
    const denominator = direction[0] * ey - direction[1] * ex;
    if (Math.abs(denominator) < 1e-9) {
      continue;
    }

    const t = ((ax - from[0]) * ey - (ay - from[1]) * ex) / denominator;
    const u = ((ax - from[0]) * direction[1] - (ay - from[1]) * direction[0]) / denominator;
    if (t > 0 && u >= 0 && u <= 1 && (farthest === undefined || t > farthest)) {
      farthest = t;
    }
  }

  return farthest === undefined ? undefined : [from[0] + direction[0] * farthest, from[1] + direction[1] * farthest];
};
