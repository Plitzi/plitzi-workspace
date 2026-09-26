import { fitsInFrame } from '../../board/model.ts';
import { boundsOf, FRAME_HEADER } from './geometry.ts';

import type { BoardElement, Point } from '../../board/model.ts';

/**
 * Frames as containers: what is in one, where a thing let go lands, and how a column arranges what is put in it.
 *
 * Membership is a field — `parent` — not a matter of where things happen to be: a frame moved takes its members
 * along, and one laid out as a column places them itself. A thing becomes a member where it is made or let go, and
 * stops being one where it is taken out.
 */

/** Between a column's edge and what it holds, and between two things in it. */
export const COLUMN_PADDING = 14;

export const COLUMN_GAP = 12;

/** How tall a column is at least, empty: somewhere to drop the first card. */
const COLUMN_MIN_HEIGHT = 260;

const inside = ([x, y]: Point, element: BoardElement): boolean =>
  x >= element.x && x <= element.x + element.width && y >= element.y && y <= element.y + element.height;

const centreOf = (element: BoardElement): Point => {
  const box = boundsOf(element);

  return [box.x + box.width / 2, box.y + box.height / 2];
};

/** The topmost frame a point is in — never one of `excluding`, which are being carried. */
export const frameAt = (
  elements: readonly BoardElement[],
  point: Point,
  excluding: ReadonlySet<string> = new Set()
): BoardElement | undefined =>
  [...elements]
    .reverse()
    .find(
      element => element.type === 'frame' && !element.deleted && !excluding.has(element.id) && inside(point, element)
    );

/** The frame an element made at a place goes in: the one its middle lands in. */
export const frameUnder = (elements: readonly BoardElement[], element: BoardElement): BoardElement | undefined =>
  fitsInFrame(element.type) ? frameAt(elements, centreOf(element), new Set([element.id])) : undefined;

export const membersOf = (elements: readonly BoardElement[], frame: string): BoardElement[] =>
  elements.filter(element => element.parent === frame && !element.deleted);

/** A column's members top to bottom — the order it lays them out in, which is the order they were put in. */
const inOrder = (members: readonly BoardElement[]): BoardElement[] =>
  [...members].sort((a, b) => centreOf(a)[1] - centreOf(b)[1] || a.x - b.x);

/**
 * Where, in a column, something let go at `y` goes: between the members above that point and those below — and the
 * board `y` of the line that shows it, halfway across the gap.
 */
export const insertionAt = (column: BoardElement, members: readonly BoardElement[], y: number): number => {
  const ordered = inOrder(members);
  const before = ordered.filter(member => centreOf(member)[1] < y);
  const last = before.at(-1);

  return last ? last.y + last.height + COLUMN_GAP / 2 : column.y + FRAME_HEADER + COLUMN_PADDING / 2;
};

/**
 * A column with its members laid out: top to bottom in the order they are in, a card as wide as the column and
 * anything else centred in it; the column as tall as it needs to be to hold them, and never shorter than it was
 * made. `measure` answers a card's height at a new width, which only the canvas can.
 */
export const layoutColumn = (
  column: BoardElement,
  members: readonly BoardElement[],
  measure: (element: BoardElement) => BoardElement
): BoardElement[] => {
  const width = column.width - COLUMN_PADDING * 2;
  let top = column.y + FRAME_HEADER + COLUMN_PADDING;
  const placed = inOrder(members).map(member => {
    const sized = member.type === 'card' ? measure({ ...member, width }) : member;
    const x = sized.type === 'card' ? column.x + COLUMN_PADDING : column.x + (column.width - sized.width) / 2;
    const next = { ...sized, x, y: top };
    top += sized.height + COLUMN_GAP;

    return next;
  });
  const height = Math.max(column.height, COLUMN_MIN_HEIGHT, top - COLUMN_GAP + COLUMN_PADDING - column.y);

  return [...(height === column.height ? [] : [{ ...column, height }]), ...placed];
};

/**
 * The frames in reading order — row by row, left to right — which is the order a board's sections are gone through,
 * and a presentation shows them. Frames whose tops are within a band of each other are one row.
 */
export const readingOrder = (frames: readonly BoardElement[]): BoardElement[] => {
  const ordered = [...frames].sort((a, b) => a.y - b.y);
  const rows: BoardElement[][] = [];
  for (const frame of ordered) {
    const row = rows.at(-1);
    if (row && frame.y - row[0].y < Math.min(row[0].height, frame.height) / 2) {
      row.push(frame);
    } else {
      rows.push([frame]);
    }
  }

  return rows.flatMap(row => row.sort((a, b) => a.x - b.x));
};

/** Whether laying an element out moved it: what a layout pass commits, and nothing it left where it was. */
export const moved = (before: BoardElement | undefined, after: BoardElement): boolean =>
  !before ||
  before.x !== after.x ||
  before.y !== after.y ||
  before.width !== after.width ||
  before.height !== after.height;
