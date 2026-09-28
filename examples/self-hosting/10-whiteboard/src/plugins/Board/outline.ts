import { readingOrder } from './containers.ts';
import { cardTitle, openBlockers } from '../../board/dependencies.ts';
import { isConnector } from '../../board/model.ts';
import { isFaceDown } from '../../board/sessions.ts';

import type { BoardElement } from '../../board/model.ts';
import type { BoardSession } from '../../board/sessions.ts';

/**
 * The board as a list, for whoever cannot read the canvas — a screen reader, keyboard use, an assistant driving the
 * browser: every frame a section in reading order with what it holds, then what lies outside any frame. Words only;
 * what was drawn by hand is counted, not described.
 */

export type OutlineKind = 'card' | 'note' | 'text' | 'comment' | 'shape' | 'picture' | 'stamp';

export type OutlineItem = {
  id: string;
  kind: OutlineKind;
  /** What it says — a card's title — or, saying nothing, what it is. */
  label: string;
  /** A card's description. */
  detail?: string;
  author?: string;
  votes: number;
  /** A card ticked done, a comment resolved. */
  done: boolean;
  locked: boolean;
  /** A card's: the titles of the cards it waits on that are still open. */
  blockedBy: string[];
  /** Written face down in a session's writing step by someone else: its words are theirs until the step is over. */
  faceDown: boolean;
  /** What it points to, by its words: the arrows that leave it. */
  pointsTo: string[];
};

export type OutlineSection = {
  /** The frame's id — none for what lies outside every frame. */
  id?: string;
  title: string;
  column: boolean;
  /** A column that is the team's Done. */
  completes: boolean;
  items: OutlineItem[];
};

/** A column a card can be moved to, as the list offers it. */
export type OutlineColumn = { id: string; title: string };

export type Outline = { sections: OutlineSection[]; columns: OutlineColumn[]; drawings: number };

const KINDS: Partial<Record<BoardElement['type'], OutlineKind>> = {
  card: 'card',
  sticky: 'note',
  stack: 'note',
  text: 'text',
  comment: 'comment',
  image: 'picture',
  stamp: 'stamp'
};

const kindOf = (element: BoardElement): OutlineKind => KINDS[element.type] ?? 'shape';

/** Top to bottom, then left to right: the order a column's cards are in, and the way a page is read. */
const byPlace = (a: BoardElement, b: BoardElement): number => a.y - b.y || a.x - b.x;

export const outlineOf = (
  elements: readonly BoardElement[],
  { session, voter }: { session: BoardSession | undefined; voter: string }
): Outline => {
  const shown = elements.filter(element => !element.deleted);
  const byId = new Map(shown.map(element => [element.id, element]));
  const find = (id: string): BoardElement | undefined => byId.get(id);
  const words = (element: BoardElement | undefined): string =>
    element ? element.text?.trim().split('\n')[0] || kindOf(element) : '';
  // The arrows by where they leave from: found once, not once for every element.
  const arrows = new Map<string, string[]>();
  for (const line of shown) {
    if (isConnector(line.type) && line.start && line.end) {
      arrows.set(line.start.id, [...(arrows.get(line.start.id) ?? []), words(find(line.end.id))]);
    }
  }

  const itemOf = (element: BoardElement): OutlineItem => {
    const faceDown = isFaceDown(element, session, voter);
    const pointsTo = faceDown ? [] : (arrows.get(element.id) ?? []);

    return {
      id: element.id,
      kind: kindOf(element),
      label: faceDown ? 'Written face down' : element.text?.trim() || (element.type === 'card' ? 'Untitled' : ''),
      ...(!faceDown && element.description?.trim() ? { detail: element.description.trim() } : {}),
      ...(element.author ? { author: element.author } : {}),
      votes: element.votes?.length ?? 0,
      done: element.done === true,
      locked: element.locked === true,
      blockedBy: element.done ? [] : openBlockers(element, find).map(cardTitle),
      faceDown,
      pointsTo: pointsTo.filter(Boolean)
    };
  };
  const listed = (element: BoardElement): boolean =>
    element.type !== 'frame' && element.type !== 'freehand' && !isConnector(element.type);

  const held = new Map<string, BoardElement[]>();
  for (const element of shown) {
    if (element.parent && listed(element)) {
      held.set(element.parent, [...(held.get(element.parent) ?? []), element]);
    }
  }

  const frames = readingOrder(shown.filter(element => element.type === 'frame'));
  const sections: OutlineSection[] = frames.map(frame => ({
    id: frame.id,
    title: frame.text?.trim() || (frame.layout === 'column' ? 'Column' : 'Frame'),
    column: frame.layout === 'column',
    completes: frame.completes === true,
    items: (held.get(frame.id) ?? []).sort(byPlace).map(itemOf)
  }));
  const loose = shown.filter(element => listed(element) && !(element.parent && byId.has(element.parent)));
  if (loose.length) {
    sections.push({
      title: 'Outside any frame',
      column: false,
      completes: false,
      items: loose.sort(byPlace).map(itemOf)
    });
  }

  return {
    sections,
    columns: sections.flatMap(section =>
      section.column && section.id ? [{ id: section.id, title: section.title }] : []
    ),
    drawings: shown.filter(element => element.type === 'freehand').length
  };
};

/**
 * `next`, with every item and section that says what it said in `previous` kept as the same object: a list of
 * thousands, told again because one card moved, redraws that card's row and nothing else.
 */
export const sharedWith = (previous: Outline, next: Outline): Outline => {
  const items = new Map(previous.sections.flatMap(section => section.items).map(item => [item.id, item]));
  const same = <T>(before: T | undefined, after: T): T =>
    before !== undefined && JSON.stringify(before) === JSON.stringify(after) ? before : after;
  const sections = new Map(previous.sections.map(section => [section.id ?? '', section]));

  return {
    drawings: next.drawings,
    columns: same(previous.columns, next.columns),
    sections: next.sections.map(section => {
      const kept = { ...section, items: section.items.map(item => same(items.get(item.id), item)) };
      const before = sections.get(section.id ?? '');

      return before &&
        before.title === kept.title &&
        before.column === kept.column &&
        before.completes === kept.completes &&
        before.items.length === kept.items.length &&
        before.items.every((item, index) => item === kept.items[index])
        ? before
        : kept;
    })
  };
};
