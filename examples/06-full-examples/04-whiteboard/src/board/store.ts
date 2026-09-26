import { randomInt } from 'node:crypto';

import { copyAssets, forgetBoardAssets, keepAsset } from './assets.ts';
import { FEATURED } from './featured.ts';
import { MAX_PASSWORD, MIN_PASSWORD, keyFor, keyOpens, lockWith, passwordOpens, topicFor } from './locks.ts';
import { LIMITS, cleanTitle, isLinear, isVoterId, mergeElements, parseElement } from './model.ts';
import { TEMPLATE_TITLES, templateElements } from './templates.ts';

import type { BoardLock } from './locks.ts';
import type { BoardElement, Point } from './model.ts';
import type { Template } from './templates.ts';
import type { ActionKvStore } from '@plitzi/sdk-server/actions';

/**
 * Where boards live: the action `kv`, which this deployment keeps in memory.
 *
 * A board is ONE value — its title, its elements by id, its password and its timer — and the gallery is one more, the
 * list of boards with a small preview of each. A restart empties both; a deployment that must keep boards hands `kv`
 * an adapter that persists, and nothing here changes.
 */

/** A countdown everyone on a board sees: when it ends, by the server's clock, and how long it was set for. */
export type BoardTimer = { endsAt: number; seconds: number };

export type StoredBoard = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  elements: Record<string, BoardElement>;
  lock?: BoardLock;
  timer?: BoardTimer;
  /** One of the boards visitors find already drawn: never the one evicted to make room. */
  featured?: boolean;
  /** Looked at together, never changed: whoever wants to change it makes a copy of their own. */
  readOnly?: boolean;
};

export type BoardSummary = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** Elements on the board, the removed ones not counted. */
  count: number;
  /** Behind a password: the gallery shows that it exists, and nothing of what is on it. */
  locked: boolean;
  featured: boolean;
  readOnly: boolean;
};

/** A board as the gallery shows it: its summary, and enough of the drawing to recognise it by. */
export type BoardCard = BoardSummary & { preview: BoardElement[] };

/** A board as a page is given it — everything on it, or, locked and not yet opened, only that it exists. */
export type OpenedBoard = {
  found: boolean;
  id: string;
  title: string;
  locked: boolean;
  /** Everyone may look around it together — cursors, laser, reactions — and nobody may change it. */
  readOnly: boolean;
  elements: BoardElement[];
  /** The part of its topics after `board:`/`room:` — empty until a locked board is opened. */
  topic: string;
  /** What every change to a locked board carries. Empty for an open board, which needs none. */
  key: string;
  timer: BoardTimer | null;
};

/** How many boards a public demo keeps. The one nobody has touched for longest makes room for a new one. */
const MAX_BOARDS = 200;

/** How many the gallery shows: the ones touched last. */
const GALLERY_BOARDS = 24;

const PREVIEW_ELEMENTS = 60;

const PREVIEW_POINTS = 120;

/** Commits one visitor may make in a ten-second window: a busy person drawing fast stays well under it. */
const COMMITS_PER_WINDOW = 80;

/** Passwords one visitor may try on one board in five minutes: enough for typos, too few to guess one. */
const ATTEMPTS_PER_WINDOW = 10;

/** The longest a timer may run: an hour is a workshop; more is a board left counting down for nobody. */
const MAX_TIMER_SECONDS = 3600;

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

const existing = async (kv: ActionKvStore, id: string): Promise<StoredBoard> => {
  const board = await readBoard(kv, id);
  if (!board) {
    throw new Error('This board no longer exists');
  }

  return board;
};

/** A locked board is read only by whoever opened it: everything asked of it carries the key opening it answered. */
const assertOpen = (board: StoredBoard, key: unknown): void => {
  if (board.lock && !keyOpens(board.id, board.lock, key)) {
    throw new Error('This board is locked: open it with its password first');
  }
};

/** Changed only by whoever may: an open board, or a locked one opened — and never a read-only one. */
const assertWritable = (board: StoredBoard, key: unknown): void => {
  assertOpen(board, key);
  if (board.readOnly) {
    throw new Error('This board is read-only — use it as a template to get a copy you can change');
  }
};

/** A timer that has run out is no timer. */
const runningTimer = (board: StoredBoard): BoardTimer | null =>
  board.timer && board.timer.endsAt > Date.now() ? board.timer : null;

/** Every n-th point, and always the last: the shape of a stroke survives, its weight in the gallery does not. */
const thin = (points: Point[]): Point[] => {
  if (points.length <= PREVIEW_POINTS) {
    return points;
  }

  const step = (points.length - 1) / (PREVIEW_POINTS - 1);

  return Array.from({ length: PREVIEW_POINTS }, (_, index) => points[Math.round(index * step)]);
};

const live = (board: StoredBoard): BoardElement[] => Object.values(board.elements).filter(element => !element.deleted);

/** What the gallery may show of a board: nothing at all of a locked one. */
const preview = (board: StoredBoard): BoardElement[] =>
  board.lock
    ? []
    : live(board)
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
    count: live(board).length,
    locked: board.lock !== undefined,
    featured: board.featured === true,
    readOnly: board.readOnly === true
  };
  const others = (await readIndex(kv)).filter(entry => entry.id !== board.id);
  const index = [summary, ...others].sort((a, b) => b.updatedAt - a.updatedAt);
  // The featured boards are kept whatever else comes and goes: they are what a first visit is shown.
  const evicted = index.filter(entry => !entry.featured).slice(MAX_BOARDS - FEATURED.length);
  await Promise.all(evicted.flatMap(entry => [kv.delete(boardKey(entry.id)), kv.delete(previewKey(entry.id))]));
  evicted.forEach(entry => forgetBoardAssets(entry.id));
  await kv.set(previewKey(board.id), preview(board));
  const gone = new Set(evicted.map(entry => entry.id));
  await kv.set(
    INDEX_KEY,
    index.filter(entry => !gone.has(entry.id))
  );
};

const save = async (kv: ActionKvStore, board: StoredBoard): Promise<void> => {
  await kv.set(boardKey(board.id), board);
  await writeSummary(kv, board);
};

/**
 * The featured boards, drawn once: on the first read after a start, with the ids they always have. A restart — the
 * boards are in memory — draws them again, fresh.
 */
const FEATURED_KEY = 'featured:v1';

const ensureFeatured = async (kv: ActionKvStore): Promise<void> => {
  if (await kv.get(FEATURED_KEY)) {
    return;
  }

  await serially(async () => {
    if (await kv.get(FEATURED_KEY)) {
      return;
    }

    const now = Date.now();
    for (const board of FEATURED) {
      await save(kv, {
        id: board.id,
        title: board.title,
        createdAt: now,
        updatedAt: now,
        featured: true,
        readOnly: true,
        elements: Object.fromEntries(board.elements().map(element => [element.id, element]))
      });
    }

    await kv.set(FEATURED_KEY, true);
  });
};

const withPreview = async (kv: ActionKvStore, summary: BoardSummary): Promise<BoardCard> => ({
  ...summary,
  preview: await readPreview(kv, summary.id)
});

/** The gallery: the featured boards, and the others touched last, newest first — each with its preview. */
export const listBoards = async (kv: ActionKvStore): Promise<{ featured: BoardCard[]; boards: BoardCard[] }> => {
  await ensureFeatured(kv);
  const index = await readIndex(kv);

  return {
    featured: await Promise.all(index.filter(entry => entry.featured).map(entry => withPreview(kv, entry))),
    boards: await Promise.all(
      index
        .filter(entry => !entry.featured)
        .slice(0, GALLERY_BOARDS)
        .map(entry => withPreview(kv, entry))
    )
  };
};

const opened = (board: StoredBoard): OpenedBoard => ({
  found: true,
  id: board.id,
  title: board.title,
  locked: board.lock !== undefined,
  readOnly: board.readOnly === true,
  elements: Object.values(board.elements),
  topic: topicFor(board.id, board.lock),
  key: board.lock ? keyFor(board.id, board.lock) : '',
  timer: runningTimer(board)
});

/**
 * A board for the first paint of its page. A locked one answers that it exists and what it is called — and nothing
 * else: its elements, its topic and its key are what opening it with the password is for.
 */
export const loadBoard = async (kv: ActionKvStore, id: string): Promise<OpenedBoard> => {
  await ensureFeatured(kv);
  const board = await readBoard(kv, id);
  if (!board) {
    return {
      found: false,
      id,
      title: '',
      locked: false,
      readOnly: false,
      elements: [],
      topic: '',
      key: '',
      timer: null
    };
  }

  return board.lock
    ? {
        found: true,
        id,
        title: board.title,
        locked: true,
        readOnly: board.readOnly === true,
        elements: [],
        topic: '',
        key: '',
        timer: null
      }
    : opened(board);
};

/**
 * A locked board, opened: with its password, or with the key a page kept from the last time. Counted per visitor,
 * so guessing is slow whether the guesses are passwords or keys.
 */
export const openBoard = async (
  kv: ActionKvStore,
  id: string,
  { password, key }: { password: unknown; key: unknown },
  callerId: string
): Promise<OpenedBoard> => {
  const board = await existing(kv, id);
  if (!board.lock) {
    return opened(board);
  }

  if (keyOpens(board.id, board.lock, key)) {
    return opened(board);
  }

  const attempts = await kv.increment(`attempts:${id}:${callerId}:${Math.floor(Date.now() / 300_000)}`, 1, 330);
  if (attempts > ATTEMPTS_PER_WINDOW) {
    throw new Error('Too many tries — wait a few minutes and try again');
  }

  if (typeof password !== 'string' || !password || !passwordOpens(board.lock, password)) {
    throw new Error('That is not this board’s password');
  }

  return opened(board);
};

export const createBoard = (
  kv: ActionKvStore,
  title: unknown,
  template: Template
): Promise<{ id: string; title: string }> =>
  serially(async () => {
    const now = Date.now();
    const typed = typeof title === 'string' && title.trim() ? title : TEMPLATE_TITLES[template];
    const board: StoredBoard = {
      id: newBoardId(),
      title: cleanTitle(typed),
      createdAt: now,
      updatedAt: now,
      elements: Object.fromEntries(templateElements(template).map(element => [element.id, element]))
    };
    await save(kv, board);

    return { id: board.id, title: board.title };
  });

/**
 * A board of one's own, drawn like another: its elements as they are now — votes left behind, they were cast on the
 * original — and its pictures. Neither locked nor read-only, whatever the original was.
 */
export const copyBoard = (kv: ActionKvStore, id: string, key: unknown): Promise<{ id: string; title: string }> =>
  serially(async () => {
    const source = await existing(kv, id);
    assertOpen(source, key);
    const now = Date.now();
    const elements = live(source).map(({ votes: _votes, ...element }) => element);
    const board: StoredBoard = {
      id: newBoardId(),
      title: cleanTitle(`${source.title} (copy)`),
      createdAt: now,
      updatedAt: now,
      elements: Object.fromEntries(elements.map(element => [element.id, element]))
    };
    copyAssets(
      source.id,
      board.id,
      elements.flatMap(element => (element.asset ? [element.asset] : []))
    );
    await save(kv, board);

    return { id: board.id, title: board.title };
  });

export const renameBoard = (
  kv: ActionKvStore,
  id: string,
  title: unknown,
  key: unknown
): Promise<{ id: string; title: string; topic: string }> =>
  serially(async () => {
    const board = await existing(kv, id);
    assertWritable(board, key);
    const renamed = { ...board, title: cleanTitle(title), updatedAt: Date.now() };
    await save(kv, renamed);

    return { id, title: renamed.title, topic: topicFor(id, board.lock) };
  });

/**
 * A password set, changed or — given none — removed. Answers the new key and topic, and the topic the board had,
 * which is where everyone still on it is told: their key no longer opens it.
 */
export const lockBoard = (
  kv: ActionKvStore,
  id: string,
  password: unknown,
  key: unknown
): Promise<{ id: string; locked: boolean; key: string; topic: string; previousTopic: string }> =>
  serially(async () => {
    const board = await existing(kv, id);
    assertWritable(board, key);
    const text = typeof password === 'string' ? password : '';
    if (text && (text.length < MIN_PASSWORD || text.length > MAX_PASSWORD)) {
      throw new Error(`A password is ${MIN_PASSWORD} to ${MAX_PASSWORD} characters`);
    }

    const previousTopic = topicFor(id, board.lock);
    const { lock: _previous, ...rest } = board;
    const next: StoredBoard = text ? { ...rest, lock: lockWith(text, board.lock) } : rest;
    await save(kv, { ...next, updatedAt: Date.now() });

    return {
      id,
      locked: next.lock !== undefined,
      key: next.lock ? keyFor(id, next.lock) : '',
      topic: topicFor(id, next.lock),
      previousTopic
    };
  });

/**
 * A board gone, with its preview, its place in the gallery and its pictures. Answers the topic it went by, which is
 * where everyone still on it is told — and sent back to the boards.
 */
export const deleteBoard = (kv: ActionKvStore, id: string, key: unknown): Promise<{ id: string; topic: string }> =>
  serially(async () => {
    const board = await existing(kv, id);
    assertWritable(board, key);
    await Promise.all([kv.delete(boardKey(id)), kv.delete(previewKey(id))]);
    await kv.set(
      INDEX_KEY,
      (await readIndex(kv)).filter(entry => entry.id !== id)
    );
    forgetBoardAssets(id);

    return { id, topic: topicFor(id, board.lock) };
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

/** The votes on an element are the server's: whatever a commit says about them, the ones kept stand. */
const withKeptVotes = (element: BoardElement, kept: BoardElement | undefined): BoardElement => {
  const { votes: _claimed, ...rest } = element;

  return kept?.votes?.length ? { ...rest, votes: kept.votes } : rest;
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
  callerId: string,
  key: unknown
): Promise<{ settled: BoardElement[]; topic: string }> => {
  const incoming = elementsOf(ops);
  const commits = await kv.increment(`rate:${callerId}:${Math.floor(Date.now() / 10_000)}`, 1, 20);
  if (commits > COMMITS_PER_WINDOW) {
    throw new Error('Too many changes at once — slow down for a moment');
  }

  return serially(async () => {
    const board = await existing(kv, id);
    assertWritable(board, key);
    const merged = mergeElements(
      board.elements,
      incoming.map(element => withKeptVotes(element, board.elements[element.id]))
    );
    if (Object.keys(merged.board).length > LIMITS.elements) {
      throw new Error(`A board holds at most ${LIMITS.elements} elements`);
    }

    await save(kv, { ...board, elements: merged.board, updatedAt: Date.now() });

    return { settled: merged.settled, topic: topicFor(id, board.lock) };
  });
};

/**
 * A vote for an element, or a vote taken back — the element announced with its votes as they now are. Done here, one
 * at a time, rather than as a commit: two people voting in the same instant would each send the element with only
 * their own vote on it, and one of them would win.
 */
export const voteOn = (
  kv: ActionKvStore,
  id: string,
  elementId: unknown,
  voter: unknown,
  key: unknown
): Promise<{ settled: BoardElement[]; topic: string }> =>
  serially(async () => {
    const board = await existing(kv, id);
    assertWritable(board, key);
    const element = typeof elementId === 'string' ? board.elements[elementId] : undefined;
    if (!element || element.deleted || isLinear(element.type)) {
      throw new Error('There is nothing to vote for there');
    }

    if (!isVoterId(voter)) {
      throw new Error('A vote needs the id this visitor keeps');
    }

    const votes = element.votes ?? [];
    const next = votes.includes(voter)
      ? votes.filter(entry => entry !== voter)
      : [...votes, voter].slice(0, LIMITS.votes);
    const { votes: _before, ...rest } = element;
    const voted: BoardElement = {
      ...rest,
      ...(next.length ? { votes: next } : {}),
      version: element.version + 1,
      nonce: randomInt(2 ** 31)
    };
    await save(kv, { ...board, elements: { ...board.elements, [voted.id]: voted }, updatedAt: Date.now() });

    return { settled: [voted], topic: topicFor(id, board.lock) };
  });

/** A countdown started — or, at zero, stopped — for everyone on the board. */
export const setTimer = (
  kv: ActionKvStore,
  id: string,
  seconds: unknown,
  key: unknown
): Promise<{ board: string; timer: BoardTimer | null; topic: string }> =>
  serially(async () => {
    const board = await existing(kv, id);
    assertWritable(board, key);
    const span = Math.round(Number(seconds));
    if (!Number.isFinite(span) || span < 0 || span > MAX_TIMER_SECONDS) {
      throw new Error(`A timer runs from 1 second to ${MAX_TIMER_SECONDS / 60} minutes`);
    }

    const { timer: _previous, ...rest } = board;
    const timer = span ? { endsAt: Date.now() + span * 1000, seconds: span } : null;
    await save(kv, timer ? { ...rest, timer } : rest);

    return { board: id, timer, topic: topicFor(id, board.lock) };
  });

/** A picture for the board, kept beside it: answers the asset id the image element names. */
export const uploadToBoard = async (
  kv: ActionKvStore,
  id: string,
  data: unknown,
  key: unknown
): Promise<{ asset: string }> => {
  const board = await existing(kv, id);
  assertWritable(board, key);

  return { asset: keepAsset(id, data) };
};
