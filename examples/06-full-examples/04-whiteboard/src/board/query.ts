import { openBlockers } from './dependencies.ts';
import { SHAPE_TYPES } from './model.ts';

import type { BoardElement, ShapeType } from './model.ts';

/**
 * Finding things on a board: one small language, read the same by the canvas's search and by an agent's
 * `find_elements`, so what a person types and what an agent asks find the same things.
 *
 * - words: in what it says — its text, a card's description, who wrote it — every one of them, in any case;
 * - `#tag`: a hashtag written in it. A tag is nothing but that: `#bug` in a note is the note tagged `bug`;
 * - `@name`: who wrote it; `in:name`: the frame it is in, by its title; `"two words"` keep together;
 * - `is:done`, `is:open`: a task ticked or not — a card, a comment; `is:locked`; `is:blocked`, a card waiting on
 *   another still open;
 * - `type:card` (`note` is a sticky), `color:red` — its line or its fill.
 */

export type Query = {
  words: string[];
  tags: string[];
  authors: string[];
  frames: string[];
  types: ShapeType[];
  colours: string[];
  done?: boolean;
  locked?: boolean;
  blocked?: boolean;
};

/** A tag: what follows `#` — letters, digits, `-` and `_`, in any script. */
const TAG = /(^|[^\p{L}\p{N}_&])#([\p{L}\p{N}][\p{L}\p{N}_-]{0,31})/gu;

/** The tags written in what an element says — its text and a card's description — lowercase, once each. */
export const tagsOf = (element: Pick<BoardElement, 'text' | 'description'>): string[] => {
  const said = `${element.text ?? ''}\n${element.description ?? ''}`;

  return [...new Set([...said.matchAll(TAG)].map(match => match[2].toLowerCase()))];
};

/** What people call the types they search for, beside the types' own names. */
const TYPE_WORDS: Record<string, ShapeType> = { note: 'sticky', notes: 'sticky', task: 'card', shape: 'rectangle' };

const typeOf = (word: string): ShapeType | undefined => {
  const lower = word.toLowerCase();

  return TYPE_WORDS[lower] ?? (isShapeType(lower) ? lower : undefined);
};

const isShapeType = (word: string): word is ShapeType => SHAPE_TYPES.some(type => type === word);

/** The query's tokens: words, and phrases kept together in quotes — `in:"to do"` is one. */
const tokensOf = (text: string): string[] =>
  (text.match(/(?:\S+?:)?"[^"]*"|\S+/g) ?? []).map(token => token.replaceAll('"', ''));

export const parseQuery = (text: string): Query => {
  const query: Query = { words: [], tags: [], authors: [], frames: [], types: [], colours: [] };
  for (const token of tokensOf(text)) {
    const lower = token.toLowerCase();
    const [prefix, ...rest] = lower.split(':');
    const value = rest.join(':').trim();
    const type = prefix === 'type' ? typeOf(value) : undefined;
    if (lower.startsWith('#') && lower.length > 1) {
      query.tags.push(lower.slice(1));
    } else if (lower.startsWith('@') && lower.length > 1) {
      query.authors.push(lower.slice(1));
    } else if (rest.length && value && prefix === 'in') {
      query.frames.push(value);
    } else if (type) {
      query.types.push(type);
    } else if (rest.length && value && (prefix === 'color' || prefix === 'colour')) {
      query.colours.push(value);
    } else if (lower === 'is:done' || lower === 'is:open') {
      query.done = lower === 'is:done';
    } else if (lower === 'is:locked') {
      query.locked = true;
    } else if (lower === 'is:blocked') {
      query.blocked = true;
    } else if (lower) {
      query.words.push(lower);
    }
  }

  return query;
};

/** A query that asks for nothing: everything matches it, and nothing is dimmed. */
export const isEmptyQuery = (query: Query): boolean =>
  !query.words.length &&
  !query.tags.length &&
  !query.authors.length &&
  !query.frames.length &&
  !query.types.length &&
  !query.colours.length &&
  query.done === undefined &&
  query.locked === undefined &&
  query.blocked === undefined;

const isTaskType = (type: ShapeType): boolean => type === 'card' || type === 'comment';

/**
 * Whether an element is what `query` asks for — every part of it at once. `find` answers the other elements on the
 * board by id: the frame an element is in, for `in:`, and the cards it waits on, for `is:blocked`. A pen stroke says
 * nothing and is found by its type and colour alone.
 */
export const matchesQuery = (
  element: BoardElement,
  query: Query,
  find: (id: string) => BoardElement | undefined
): boolean => {
  if (element.deleted) {
    return false;
  }

  const said = `${element.text ?? ''}\n${element.description ?? ''}\n${element.author ?? ''}`.toLowerCase();
  const tags = query.tags.length ? tagsOf(element) : [];
  const author = (element.author ?? '').toLowerCase();
  const frame = element.parent ? (find(element.parent)?.text?.trim() ?? '').toLowerCase() : '';

  return (
    query.words.every(word => said.includes(word)) &&
    query.tags.every(tag => tags.includes(tag)) &&
    query.authors.every(name => author.startsWith(name)) &&
    query.frames.every(title => frame.includes(title)) &&
    (!query.types.length || query.types.includes(element.type)) &&
    query.colours.every(colour => element.stroke === colour || element.fill === colour) &&
    (query.done === undefined || (isTaskType(element.type) && (element.done === true) === query.done)) &&
    (query.locked === undefined || element.locked === true) &&
    (query.blocked === undefined || (!element.done && openBlockers(element, find).length > 0))
  );
};
