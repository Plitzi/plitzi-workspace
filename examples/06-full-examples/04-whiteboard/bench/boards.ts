import { callAction } from '../src/agent/session.ts';
import { drawing, newId, scribble, sticky } from '../src/board/sketch.ts';

import type { BoardElement } from '../src/board/model.ts';
import type { Draft } from '../src/board/sketch.ts';

/**
 * A board as people fill one: cells of a note, a box and an ellipse joined by arrows, a pen stroke and a line of text
 * — every kind of element the canvas draws differently, in the proportions a workshop leaves behind. Laid out on a
 * grid, so zooming to fit puts every one of them on screen, and seeded, so every run draws the same board.
 */

const CELL = 320;

/** How many elements one cell holds: a note, a box, an ellipse, two arrows, a stroke, a text. */
const PER_CELL = 7;

const cellOf = (index: number, columns: number): Draft[] => {
  const x = (index % columns) * CELL;
  const y = Math.floor(index / columns) * CELL;
  const note = { ...sticky(x, y, `Idea ${index + 1} — something to talk about`), id: newId() };
  const box: Draft = { id: newId(), type: 'rectangle', x: x + 150, y: y + 10, width: 120, height: 70, text: 'Step' };
  const round: Draft = { id: newId(), type: 'ellipse', x: x + 150, y: y + 110, width: 120, height: 70 };
  const arrow = (from: string, to: string): Draft => ({
    type: 'arrow',
    x: 0,
    y: 0,
    points: [
      [0, 0],
      [1, 1]
    ],
    start: { id: from, anchor: 'e' },
    end: { id: to, anchor: 'w' }
  });
  const stroke = scribble(
    Array.from({ length: 6 }, (_, step): [number, number] => [x + 10 + step * 40, y + 230 + (step % 2) * 30]),
    'blue',
    index + 1
  );
  const words: Draft = { type: 'text', x: x + 10, y: y + 290, text: `Note ${index + 1}` };

  return [note, box, round, arrow(note.id ?? '', box.id ?? ''), arrow(box.id ?? '', round.id ?? ''), stroke, words];
};

/** `count` elements, in whole cells, over a square grid. */
export const benchElements = (count: number): BoardElement[] => {
  const cells = Math.max(1, Math.round(count / PER_CELL));
  const columns = Math.ceil(Math.sqrt(cells));

  return drawing(Array.from({ length: cells }, (_, index) => cellOf(index, columns)).flat()).slice(0, count);
};

/** The most a commit may carry (`LIMITS.ops`). */
const COMMIT = 500;

/** A new board holding `count` elements, committed as a page would — through `board-apply`. */
export const seedBoard = async (
  origin: string,
  count: number
): Promise<{ id: string; owner: string; elements: number }> => {
  const created = await callAction(origin, 'board-create', { title: `Bench — ${count} elements`, template: 'blank' });
  if (typeof created !== 'object' || created === null || !('id' in created) || typeof created.id !== 'string') {
    throw new Error('board-create answered no board');
  }

  const owner = 'owner' in created && typeof created.owner === 'string' ? created.owner : '';
  const elements = benchElements(count);
  for (let from = 0; from < elements.length; from += COMMIT) {
    await callAction(origin, 'board-apply', {
      board: created.id,
      ops: elements.slice(from, from + COMMIT),
      key: '',
      owner
    });
  }

  return { id: created.id, owner, elements: elements.length };
};
