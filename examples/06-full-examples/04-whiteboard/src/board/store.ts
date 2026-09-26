import { randomInt } from 'node:crypto';

import { LIMITS, cleanTitle, isLinear, mergeElements, parseElement } from './model.ts';

import type { BoardElement, Point } from './model.ts';
import type { ActionKvStore } from '@plitzi/sdk-server/actions';

/**
 * Where boards live: the action `kv`, which this deployment keeps in memory.
 *
 * A board is ONE value — its title and every element by id — and the gallery is one more, the list of boards with a
 * small preview of each. A restart empties both; a deployment that must keep boards hands `kv` an adapter that
 * persists, and nothing here changes.
 */

export type StoredBoard = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  elements: Record<string, BoardElement>;
};

export type BoardSummary = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** Elements on the board, the removed ones not counted. */
  count: number;
};

/** A board as the gallery shows it: its summary, and enough of the drawing to recognise it by. */
export type BoardCard = BoardSummary & { preview: BoardElement[] };

/** How many boards a public demo keeps. The one nobody has touched for longest makes room for a new one. */
const MAX_BOARDS = 200;

/** How many the gallery shows: the ones touched last. */
const GALLERY_BOARDS = 24;

const PREVIEW_ELEMENTS = 60;

const PREVIEW_POINTS = 120;

/** Commits one visitor may make in a ten-second window: a busy person drawing fast stays well under it. */
const COMMITS_PER_WINDOW = 80;

const INDEX_KEY = 'boards';

const boardKey = (id: string): string => `board:${id}`;

/**
 * Each board's preview under a key of its own, so a commit rewrites one small value and the list of boards — never
 * every board's drawing.
 */
const previewKey = (id: string): string => `preview:${id}`;

/**
 * One write at a time, for the whole process.
 *
 * A commit is read, merge, write — and two commits interleaved between the read and the write would drop one of
 * them. The action `kv` is in memory here, so every write is this process's and a queue is the whole answer; a
 * deployment running several needs a store that can compare-and-set, which is a property of the store, not of this.
 */
let queue: Promise<unknown> = Promise.resolve();

const serially = <T>(work: () => Promise<T>): Promise<T> => {
  const run = queue.then(work, work);
  queue = run.catch(() => undefined);

  return run;
};

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

/** Ten characters from an alphabet without the ones that read alike (l/1, o/0): a link someone can read out. */
const newBoardId = (): string => Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

// The casts below are the store's own round trip: these keys are written by this file and nothing else, so what comes
// back is what went in — `kv` hands every value back as `unknown` because it cannot know that.

const readIndex = async (kv: ActionKvStore): Promise<BoardSummary[]> => {
  const value = await kv.get(INDEX_KEY);

  return Array.isArray(value) ? (value as BoardSummary[]) : [];
};

const readBoard = async (kv: ActionKvStore, id: string): Promise<StoredBoard | undefined> => {
  const value = await kv.get(boardKey(id));

  return typeof value === 'object' && value !== null ? (value as StoredBoard) : undefined;
};

const readPreview = async (kv: ActionKvStore, id: string): Promise<BoardElement[]> => {
  const value = await kv.get(previewKey(id));

  return Array.isArray(value) ? (value as BoardElement[]) : [];
};

/** Every n-th point, and always the last: the shape of a stroke survives, its weight in the gallery does not. */
const thin = (points: Point[]): Point[] => {
  if (points.length <= PREVIEW_POINTS) {
    return points;
  }

  const step = (points.length - 1) / (PREVIEW_POINTS - 1);

  return Array.from({ length: PREVIEW_POINTS }, (_, index) => points[Math.round(index * step)]);
};

const live = (board: StoredBoard): BoardElement[] => Object.values(board.elements).filter(element => !element.deleted);

const preview = (board: StoredBoard): BoardElement[] =>
  live(board)
    .sort((a, b) => a.z - b.z)
    .slice(-PREVIEW_ELEMENTS)
    .map(element =>
      isLinear(element.type) && element.points ? { ...element, points: thin(element.points) } : element
    );

/** The gallery's entry for a board, replaced — and the list trimmed to what the demo keeps. */
const writeSummary = async (kv: ActionKvStore, board: StoredBoard): Promise<void> => {
  const summary: BoardSummary = {
    id: board.id,
    title: board.title,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
    count: live(board).length
  };
  const others = (await readIndex(kv)).filter(entry => entry.id !== board.id);
  const index = [summary, ...others].sort((a, b) => b.updatedAt - a.updatedAt);
  const evicted = index.slice(MAX_BOARDS);
  await Promise.all(evicted.flatMap(entry => [kv.delete(boardKey(entry.id)), kv.delete(previewKey(entry.id))]));
  await kv.set(previewKey(board.id), preview(board));
  await kv.set(INDEX_KEY, index.slice(0, MAX_BOARDS));
};

/** The boards touched last, newest first, each with its preview. */
export const listBoards = async (kv: ActionKvStore): Promise<BoardCard[]> => {
  const recent = (await readIndex(kv)).slice(0, GALLERY_BOARDS);

  return Promise.all(recent.map(async summary => ({ ...summary, preview: await readPreview(kv, summary.id) })));
};

export const loadBoard = async (
  kv: ActionKvStore,
  id: string
): Promise<{ found: boolean; id: string; title: string; elements: BoardElement[] }> => {
  const board = await readBoard(kv, id);

  return board
    ? { found: true, id, title: board.title, elements: Object.values(board.elements) }
    : { found: false, id, title: '', elements: [] };
};

export const createBoard = (kv: ActionKvStore, title: unknown): Promise<{ id: string; title: string }> =>
  serially(async () => {
    const now = Date.now();
    const board: StoredBoard = {
      id: newBoardId(),
      title: cleanTitle(title),
      createdAt: now,
      updatedAt: now,
      elements: {}
    };
    await kv.set(boardKey(board.id), board);
    await writeSummary(kv, board);

    return { id: board.id, title: board.title };
  });

export const renameBoard = (kv: ActionKvStore, id: string, title: unknown): Promise<{ id: string; title: string }> =>
  serially(async () => {
    const board = await readBoard(kv, id);
    if (!board) {
      throw new Error('This board no longer exists');
    }

    const renamed = { ...board, title: cleanTitle(title), updatedAt: Date.now() };
    await kv.set(boardKey(id), renamed);
    await writeSummary(kv, renamed);

    return { id, title: renamed.title };
  });

/** A commit arrives as the flow sent it: the elements themselves, or their JSON. */
const elementsOf = (ops: unknown): BoardElement[] => {
  let value = ops;
  if (typeof ops === 'string') {
    try {
      value = JSON.parse(ops) as unknown;
    } catch {
      throw new Error('A commit is a list of elements');
    }
  }

  if (!Array.isArray(value) || !value.length || value.length > LIMITS.ops) {
    throw new Error(`A commit is a list of 1 to ${LIMITS.ops} elements`);
  }

  const elements = value.map(parseElement);
  const invalid = elements.findIndex(element => !element);
  if (invalid !== -1) {
    throw new Error(`Element ${invalid + 1} of the commit is not a board element`);
  }

  return elements.filter(element => element !== undefined);
};

/**
 * One commit: validated, merged element by element, kept — and answered with what each element it touched now is,
 * for the action to announce on the board's channel.
 *
 * All or nothing: a commit with one malformed element is refused whole, because a partial one is a drawing half-moved.
 */
export const applyToBoard = async (
  kv: ActionKvStore,
  id: string,
  ops: unknown,
  callerId: string
): Promise<{ settled: BoardElement[] }> => {
  const incoming = elementsOf(ops);
  const commits = await kv.increment(`rate:${callerId}:${Math.floor(Date.now() / 10_000)}`, 1, 20);
  if (commits > COMMITS_PER_WINDOW) {
    throw new Error('Too many changes at once — slow down for a moment');
  }

  return serially(async () => {
    const board = await readBoard(kv, id);
    if (!board) {
      throw new Error('This board no longer exists');
    }

    const merged = mergeElements(board.elements, incoming);
    if (Object.keys(merged.board).length > LIMITS.elements) {
      throw new Error(`A board holds at most ${LIMITS.elements} elements`);
    }

    const next = { ...board, elements: merged.board, updatedAt: Date.now() };
    await kv.set(boardKey(id), next);
    await writeSummary(kv, next);

    return { settled: merged.settled };
  });
};
