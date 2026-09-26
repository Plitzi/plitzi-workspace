import type { Box } from './geometry.ts';

/**
 * Smart guides, as design tools have them: while something is dragged, an edge or the middle of it that comes within a
 * few pixels of an edge or the middle of something still on the board lands on it — and a line shows what it lined up
 * with. Pure: the stops are gathered once as a drag starts, and every move only looks up the nearest.
 */

/** How close, in pixels on screen, an edge comes before it snaps: near enough to feel it, far enough to escape it. */
export const SNAP_DISTANCE = 6;

type Axis = 'x' | 'y';

/** Where something still lines up along one axis — an edge or its middle — and the span it covers across it. */
type Stop = { at: number; from: number; to: number };

/** The stops of what stays still, sorted along each axis. */
export type Guides = { x: Stop[]; y: Stop[] };

/** A line drawn while dragging: where things line up, across everything that lines up there. */
export type GuideLine = { axis: Axis; at: number; from: number; to: number };

/** Nearer than this, two positions are the same line: what was snapped is exactly on it, give or take rounding. */
const SAME = 0.01;

/** A box's three stops along an axis — its start, its middle, its end — each with the span it covers across. */
const stopsOf = (box: Box, axis: Axis): Stop[] => {
  const [start, size, across, length] =
    axis === 'x' ? [box.x, box.width, box.y, box.height] : [box.y, box.height, box.x, box.width];

  return [start, start + size / 2, start + size].map(at => ({ at, from: across, to: across + length }));
};

export const guidesFrom = (still: readonly Box[]): Guides => ({
  x: still.flatMap(box => stopsOf(box, 'x')).sort((a, b) => a.at - b.at),
  y: still.flatMap(box => stopsOf(box, 'y')).sort((a, b) => a.at - b.at)
});

/** The stops within `reach` of `at`, nearest the start first: a binary search to the first, and on while in reach. */
const stopsNear = (stops: readonly Stop[], at: number, reach: number): Stop[] => {
  let [low, high] = [0, stops.length];
  while (low < high) {
    const middle = (low + high) >> 1;
    if (stops[middle].at < at - reach) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  const near: Stop[] = [];
  for (let index = low; index < stops.length && stops[index].at <= at + reach; index += 1) {
    near.push(stops[index]);
  }

  return near;
};

/** The shortest shift that puts one of the dragged box's `own` stops on a stop within `reach` — none when none is. */
const nearestShift = (stops: readonly Stop[], own: readonly Stop[], reach: number): number | undefined => {
  let best: number | undefined;
  for (const { at } of own) {
    for (const stop of stopsNear(stops, at, reach)) {
      const shift = stop.at - at;
      if (best === undefined || Math.abs(shift) < Math.abs(best)) {
        best = shift;
      }
    }
  }

  return best;
};

/** The lines along an axis that `box` sits on: each running across it and everything still that lines up there. */
const linesOn = (stops: readonly Stop[], box: Box, axis: Axis): GuideLine[] =>
  stopsOf(box, axis).flatMap(own => {
    const matched = stopsNear(stops, own.at, SAME);

    return matched.length
      ? [
          {
            axis,
            at: own.at,
            from: Math.min(own.from, ...matched.map(stop => stop.from)),
            to: Math.max(own.to, ...matched.map(stop => stop.to))
          }
        ]
      : [];
  });

/**
 * Where `box` — what is dragged, where the pointer would put it — lands: shifted by at most `reach` on each axis so an
 * edge or its middle meets the nearest stop, and the lines that show what it met. Each axis snaps on its own.
 */
export const snapBox = (box: Box, guides: Guides, reach: number): { dx: number; dy: number; lines: GuideLine[] } => {
  const dx = nearestShift(guides.x, stopsOf(box, 'x'), reach);
  const dy = nearestShift(guides.y, stopsOf(box, 'y'), reach);
  const snapped = { ...box, x: box.x + (dx ?? 0), y: box.y + (dy ?? 0) };

  return {
    dx: dx ?? 0,
    dy: dy ?? 0,
    lines: [
      ...(dx === undefined ? [] : linesOn(guides.x, snapped, 'x')),
      ...(dy === undefined ? [] : linesOn(guides.y, snapped, 'y'))
    ]
  };
};
