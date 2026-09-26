import { randomInt } from 'node:crypto';

import { FILLS, fitsInFrame, holdsText, isAuthored, STROKES } from '../board/model.ts';
import { estimatedCardHeight } from '../board/sketch.ts';
import { COLUMN_GAP, COLUMN_PADDING, layoutColumn, membersOf, moved } from '../plugins/Board/containers.ts';
import { FRAME_HEADER } from '../plugins/Board/geometry.ts';
import { newElementId } from './session.ts';

import type { Session } from './session.ts';
import type { BoardElement, Fill, Layout, ShapeType, Stroke } from '../board/model.ts';

/**
 * What an agent asks for, made into elements a canvas would have made: the usual sizes, a colour by name, a place
 * where it asked or — when it did not — a free one, and in a column frame the place the column gives it. The agent
 * never has to do geometry to put a note on a board.
 */

export type AddSpec = {
  type: ShapeType;
  text?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color?: string;
  /** A frame's id or title: put in it. */
  frame?: string;
  layout?: Layout;
  done?: boolean;
};

const SIZES: Partial<Record<ShapeType, { width: number; height: number }>> = {
  sticky: { width: 200, height: 200 },
  card: { width: 260, height: 60 },
  frame: { width: 480, height: 400 },
  comment: { width: 32, height: 32 },
  stack: { width: 222, height: 252 }
};

const SHAPE_SIZE = { width: 170, height: 110 };

/** A card's height, as the canvas would measure it: its words wrapped at its width, and the row for its author. */
export const cardHeight = (element: BoardElement): number =>
  estimatedCardHeight(element.text ?? '', element.width, element.author !== undefined);

/** A text's box, as the canvas would measure it in the hand-drawn face. */
const textBox = (text: string): { width: number; height: number } => {
  const lines = text.split('\n');

  return {
    width: Math.max(40, ...lines.map(line => line.length * 15)),
    height: lines.length * 35
  };
};

const measured = (element: BoardElement): BoardElement => {
  if (element.type === 'card') {
    return { ...element, height: cardHeight(element) };
  }

  return element.type === 'text' ? { ...element, ...textBox(element.text ?? '') } : element;
};

const fillOf = (type: ShapeType, color: string | undefined): Fill => {
  const named = FILLS.find(fill => fill === color);
  if (type === 'sticky' || type === 'stack') {
    return named && named !== 'none' ? named : 'yellow';
  }

  return named ?? 'none';
};

const strokeOf = (color: string | undefined): Stroke => STROKES.find(stroke => stroke === color) ?? 'ink';

/** The frame an agent named, by id or by title. */
export const frameNamed = (session: Session, name: string | undefined): BoardElement | undefined => {
  if (!name) {
    return undefined;
  }

  const frames = session.elements().filter(element => element.type === 'frame');

  return (
    frames.find(frame => frame.id === name) ??
    frames.find(frame => (frame.text ?? '').trim().toLowerCase() === name.trim().toLowerCase())
  );
};

/** One element from a spec, at its usual size, not yet placed. */
const build = (session: Session, spec: AddSpec, z: number): BoardElement => {
  const size = SIZES[spec.type] ?? SHAPE_SIZE;
  const text = spec.text ?? (holdsText(spec.type) ? '' : undefined);
  const element: BoardElement = {
    id: newElementId(),
    type: spec.type,
    x: spec.x ?? 0,
    y: spec.y ?? 0,
    width: spec.width ?? size.width,
    height: spec.height ?? size.height,
    stroke: strokeOf(spec.type === 'text' || !SIZES[spec.type] ? spec.color : undefined),
    fill: spec.type === 'text' ? 'none' : fillOf(spec.type, spec.color),
    strokeWidth: 2,
    seed: randomInt(2 ** 31),
    z,
    version: 0,
    nonce: 0,
    deleted: false,
    ...(text === undefined ? {} : { text }),
    ...(isAuthored(spec.type) ? { author: session.name } : {}),
    ...(spec.type === 'frame' && spec.layout ? { layout: spec.layout } : {}),
    ...(spec.done && (spec.type === 'card' || spec.type === 'comment') ? { done: true } : {})
  };

  return measured(element);
};

const overlaps = (a: BoardElement, b: BoardElement, margin: number): boolean =>
  a.x < b.x + b.width + margin &&
  a.x + a.width + margin > b.x &&
  a.y < b.y + b.height + margin &&
  a.y + a.height + margin > b.y;

/**
 * Elements for specs, placed, with whatever else placing them moved: in a column frame, the column laid out again;
 * in a free frame, a grid under its title; elsewhere a grid beside what is already on the board — or, where the agent
 * gave coordinates, exactly there.
 */
export const placeAll = (session: Session, specs: readonly AddSpec[]): BoardElement[] => {
  let z = session.topZ();
  const existing = session.elements();
  const made: BoardElement[] = [];
  const loose: BoardElement[] = [];
  const byFrame = new Map<string, BoardElement[]>();

  for (const spec of specs) {
    z += 1;
    const element = build(session, spec, z);
    const frame = fitsInFrame(spec.type) ? frameNamed(session, spec.frame) : undefined;
    if (frame) {
      const members = byFrame.get(frame.id) ?? [];
      members.push({ ...element, parent: frame.id });
      byFrame.set(frame.id, members);
    } else if (spec.x === undefined || spec.y === undefined) {
      loose.push(element);
    } else {
      made.push(element);
    }
  }

  // Into frames: a column stacks them after what it holds; a free frame takes them in a grid under its title.
  const extra: BoardElement[] = [];
  for (const [id, added] of byFrame) {
    // Found a moment ago, by `frameNamed`: the same board, so it is there.
    const frame = session.element(id);
    if (!frame) {
      loose.push(...added);
      continue;
    }

    const members = membersOf(existing, id);
    if (frame.layout === 'column') {
      const bottom = Math.max(frame.y + FRAME_HEADER, ...members.map(member => member.y + member.height));
      const queued = added.map((element, index) => ({ ...element, y: bottom + COLUMN_GAP + index }));
      const width = frame.width - COLUMN_PADDING * 2;
      for (const laid of layoutColumn(frame, [...members, ...queued], element =>
        element.type === 'card' ? measured({ ...element, width }) : element
      )) {
        const before = existing.find(element => element.id === laid.id);
        if (queued.some(element => element.id === laid.id)) {
          made.push(laid);
        } else if (moved(before, laid)) {
          extra.push(laid);
        }
      }
    } else {
      const top = Math.max(frame.y + FRAME_HEADER + 20, ...members.map(member => member.y + member.height + 20));
      let [x, y, row] = [frame.x + 20, top, 0];
      for (const element of added) {
        if (x + element.width > frame.x + frame.width - 20 && x > frame.x + 20) {
          [x, y, row] = [frame.x + 20, y + row + 20, 0];
        }

        made.push({ ...element, x, y });
        x += element.width + 20;
        row = Math.max(row, element.height);
      }

      const needed = y + row + 20 - frame.y;
      if (needed > frame.height) {
        extra.push({ ...frame, height: needed });
      }
    }
  }

  // Anywhere: a grid beside what is on the board, clear of it.
  if (loose.length) {
    const right = existing.length ? Math.max(...existing.map(element => element.x + element.width)) + 120 : 0;
    const top = existing.length ? Math.min(...existing.map(element => element.y)) : 0;
    const columns = Math.ceil(Math.sqrt(loose.length));
    const cellWidth = Math.max(...loose.map(element => element.width)) + 40;
    const cellHeight = Math.max(...loose.map(element => element.height)) + 40;
    loose.forEach((element, index) => {
      let placed = {
        ...element,
        x: right + (index % columns) * cellWidth,
        y: top + Math.floor(index / columns) * cellHeight
      };
      while (existing.some(other => overlaps(placed, other, 20))) {
        placed = { ...placed, y: placed.y + cellHeight };
      }

      made.push(placed);
    });
  }

  return [...made, ...extra];
};
