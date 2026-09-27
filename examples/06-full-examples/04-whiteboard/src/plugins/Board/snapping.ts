import { COLUMN_GAP } from './containers.ts';

import type { Box } from './geometry.ts';

/**
 * Smart guides, as design tools have them: while something is dragged, an edge or the middle of it that comes within a
 * few pixels of an edge or the middle of something still on the board lands on it — and a line shows what it lined up
 * with. Brought beside something, it also stops at a set distance from it (`GAPS`), side by side, one over the other,
 * or corner to corner — and a short line marks the gap. Pure: the stops are gathered once as a drag starts, and every
 * move only looks up the nearest.
 */

/**
 * The distances something stops at beside what it is brought next to, in board units, from furthest to nearest: room
 * to breathe, a kanban column's own spacing between cards, and all but touching.
 */
export const GAPS = [24, COLUMN_GAP, 2] as const;

/** How close, in pixels on screen, an edge comes before it snaps: near enough to feel it, far enough to escape it. */
export const SNAP_DISTANCE = 6;

type Axis = 'x' | 'y';

/** Where something still lines up along one axis — an edge or its middle — and the span it covers across it. */
type Stop = { at: number; from: number; to: number };

/**
 * Where the dragged box's `edge` — its start, or its end — stops at `gap` from a box still on the board, whose facing
 * side is at `wall`; `from`/`to` is the still box's span across.
 */
type GapStop = Stop & { edge: 'start' | 'end'; gap: number; wall: number };

/** The stops of what stays still, sorted along each axis: edges and middles to line up with, and gaps to keep. */
export type Guides = { x: Stop[]; y: Stop[]; gapX: GapStop[]; gapY: GapStop[] };

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

/** A box's gap stops along an axis: past its end, and before its start, at each distance. */
const gapStopsOf = (box: Box, axis: Axis): GapStop[] => {
  const [start, size, across, length] =
    axis === 'x' ? [box.x, box.width, box.y, box.height] : [box.y, box.height, box.x, box.width];

  return GAPS.flatMap(gap => [
    { at: start + size + gap, edge: 'start' as const, gap, wall: start + size, from: across, to: across + length },
    { at: start - gap, edge: 'end' as const, gap, wall: start, from: across, to: across + length }
  ]);
};

const byPosition = (a: Stop, b: Stop): number => a.at - b.at;

export const guidesFrom = (still: readonly Box[]): Guides => ({
  x: still.flatMap(box => stopsOf(box, 'x')).sort(byPosition),
  y: still.flatMap(box => stopsOf(box, 'y')).sort(byPosition),
  gapX: still.flatMap(box => gapStopsOf(box, 'x')).sort(byPosition),
  gapY: still.flatMap(box => gapStopsOf(box, 'y')).sort(byPosition)
});

/** The dragged box's span across `axis`: what a gap stop has to face for the gap to be between the two. */
const acrossOf = (box: Box, axis: Axis): [number, number] =>
  axis === 'x' ? [box.y, box.y + box.height] : [box.x, box.x + box.width];

/**
 * Whether a gap stop faces the dragged box: their spans across overlap, or all but — near enough that a corner brought
 * to a corner keeps the gap on both axes.
 */
const faces = (stop: GapStop, [from, to]: [number, number], reach: number): boolean =>
  from <= stop.to + GAPS[0] + reach && to >= stop.from - GAPS[0] - reach;

/** The stops within `reach` of `at`, nearest the start first: a binary search to the first, and on while in reach. */
const stopsNear = <S extends Stop>(stops: readonly S[], at: number, reach: number): S[] => {
  let [low, high] = [0, stops.length];
  while (low < high) {
    const middle = (low + high) >> 1;
    if (stops[middle].at < at - reach) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  const near: S[] = [];
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

/** The dragged box's edge a gap stop is for, along `axis`. */
const edgeOf = (box: Box, axis: Axis, edge: 'start' | 'end'): number => {
  const [start, size] = axis === 'x' ? [box.x, box.width] : [box.y, box.height];

  return edge === 'start' ? start : start + size;
};

/** The shortest shift that puts an edge of `box` at a gap from something it faces, within `reach` — none when none is. */
const nearestGapShift = (stops: readonly GapStop[], box: Box, axis: Axis, reach: number): number | undefined => {
  const across = acrossOf(box, axis);
  let best: number | undefined;
  for (const edge of ['start', 'end'] as const) {
    const at = edgeOf(box, axis, edge);
    for (const stop of stopsNear(stops, at, reach)) {
      if (stop.edge === edge && faces(stop, across, reach)) {
        const shift = stop.at - at;
        if (best === undefined || Math.abs(shift) < Math.abs(best)) {
          best = shift;
        }
      }
    }
  }

  return best;
};

/** The nearer of two shifts, either of which may be none. */
const nearer = (a: number | undefined, b: number | undefined): number | undefined =>
  a === undefined ? b : b === undefined || Math.abs(a) <= Math.abs(b) ? a : b;

/**
 * The gaps `box` keeps along `axis`: a short line across each, halfway along where the two face each other — the mark
 * design tools make for a distance.
 */
const gapLinesOn = (stops: readonly GapStop[], box: Box, axis: Axis): GuideLine[] => {
  const [from, to] = acrossOf(box, axis);
  const other: Axis = axis === 'x' ? 'y' : 'x';

  return (['start', 'end'] as const).flatMap(edge =>
    stopsNear(stops, edgeOf(box, axis, edge), SAME)
      .filter(stop => stop.edge === edge && faces(stop, [from, to], 0))
      .slice(0, 1)
      .map(stop => {
        // Where the two face each other — or, corner to corner, between their nearest corners.
        const low = Math.max(from, stop.from);
        const high = Math.min(to, stop.to);
        const middle = low <= high ? (low + high) / 2 : to < stop.from ? (to + stop.from) / 2 : (from + stop.to) / 2;

        return { axis: other, at: middle, from: Math.min(stop.wall, stop.at), to: Math.max(stop.wall, stop.at) };
      })
  );
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
  const dx = nearer(nearestShift(guides.x, stopsOf(box, 'x'), reach), nearestGapShift(guides.gapX, box, 'x', reach));
  const dy = nearer(nearestShift(guides.y, stopsOf(box, 'y'), reach), nearestGapShift(guides.gapY, box, 'y', reach));
  const snapped = { ...box, x: box.x + (dx ?? 0), y: box.y + (dy ?? 0) };

  return {
    dx: dx ?? 0,
    dy: dy ?? 0,
    lines: [
      ...(dx === undefined ? [] : [...linesOn(guides.x, snapped, 'x'), ...gapLinesOn(guides.gapX, snapped, 'x')]),
      ...(dy === undefined ? [] : [...linesOn(guides.y, snapped, 'y'), ...gapLinesOn(guides.gapY, snapped, 'y')])
    ]
  };
};
