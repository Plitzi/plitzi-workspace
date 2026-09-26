import { randomInt } from 'node:crypto';

import { ActionRefusal } from '@plitzi/sdk-server/actions';

import { keepAsset } from './assets.ts';
import { FEATURED } from './featured.ts';
import { lockWith, passwordOpens, passwordProblem } from './locks.ts';
import {
  LIFETIMES,
  LIMITS,
  byStacking,
  cleanTitle,
  isLinear,
  isVoterId,
  mergeElements,
  parseElement
} from './model.ts';
import { TEMPLATE_TITLES, templateElements } from './templates.ts';

import type { AssetStore } from './assets.ts';
import type { BoardLock, BoardSigner } from './locks.ts';
import type { BoardElement, Point } from './model.ts';
import type { Template } from './templates.ts';
import type { ActionKvStore } from '@plitzi/sdk-server/actions';

/**
 * Where boards live: the action `kv` — this process's memory for one server, Redis for several (`deployment.ts`).
 *
 * A board is ONE value — its title, its elements by id, its password and its timer — and the gallery is one more, the
 * list of boards with a small preview of each. In memory a restart empties both; a deployment that must keep boards
 * hands `kv` an adapter that persists, and nothing here changes.
 */

/** What the board functions work over: the action `kv`, where pictures are kept, and what keys and topics are signed with. */
export type BoardStores = { kv: ActionKvStore; assets: AssetStore; signer: BoardSigner };

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
  /** Private: never listed on the front page — reached only by whoever has the link. */
  unlisted?: boolean;
  /** Temporary: gone for everyone at this instant, with everything on it. */
  expiresAt?: number;
};

/** A line of the board's chat: who said it, in their colour, and when — an agent's marked as one. */
export type ChatMessage = {
  id: string;
  name: string;
  color: string;
  text: string;
  at: number;
  /** The id the sender's browser keeps — how a page tells its own lines from the others'. */
  by: string;
  agent?: boolean;
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
  unlisted: boolean;
  expiresAt: number | null;
};

/** A board as the gallery shows it: its summary, and enough of the drawing to recognise it by. */
export type BoardCard = BoardSummary & { preview: BoardElement[] };

/** A board as a page is given it — everything on it, or, locked and not yet opened, only that it exists. */
export type OpenedBoard = {
  found: boolean;
  id: string;
  title: string;
  locked: boolean;
  /**
   * Everyone may look around it together — cursors, laser, reactions — and nobody may change it but whoever made it
   * read-only, with the owner key they were given.
   */
  readOnly: boolean;
  /** One of the boards a first visit is shown: read-only for everyone, as nobody holds its owner key. */
  featured: boolean;
  elements: BoardElement[];
  /** The part of its topics after `board:`/`room:` — empty until a locked board is opened. */
  topic: string;
  /** What every change to a locked board carries. Empty for an open board, which needs none. */
  key: string;
  timer: BoardTimer | null;
  unlisted: boolean;
  /** When a temporary board goes — `null` for one that stays. */
  expiresAt: number | null;
  /** The last of what was said in its chat, oldest first. */
  chat: ChatMessage[];
};

/** A board that is not there — never was, was deleted, or ran out of time. */
export const missingBoard = (id: string): OpenedBoard => ({
  found: false,
  id,
  title: '',
  locked: false,
  readOnly: false,
  featured: false,
  elements: [],
  topic: '',
  key: '',
  timer: null,
  unlisted: false,
  expiresAt: null,
  chat: []
});

/** How many boards a public demo keeps. The one nobody has touched for longest makes room for a new one. */
const MAX_BOARDS = 200;

/** How many the gallery shows: the ones touched last. */
const GALLERY_BOARDS = 24;

const PREVIEW_ELEMENTS = 140;

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

const chatKey = (id: string): string => `chat:${id}`;

/** What a board's chat keeps, and what a page is given of it. */
const CHAT_KEPT = 200;

const CHAT_SERVED = 100;

/** Lines one visitor may say in ten seconds: a conversation, not a flood. */
const CHATS_PER_WINDOW = 20;

const expired = (board: { expiresAt?: number | null }, now = Date.now()): boolean =>
  typeof board.expiresAt === 'number' && board.expiresAt <= now;

/** What a temporary board's keys live for: until it goes, and not a second longer — the store forgets them itself. */
const lifetimeOf = (board: StoredBoard): number | undefined =>
  board.expiresAt === undefined ? undefined : Math.max(1, Math.ceil((board.expiresAt - Date.now()) / 1000));

/**
 * One write at a time — across every replica sharing the store.
 *
 * A commit is read, merge, write, and two commits interleaved between the read and the write would drop one of them.
 * Within a process a queue keeps them apart; between processes the queue's head takes a lock in the `kv` itself: the
 * first `increment` of its key answers 1, and whoever gets anything else waits and asks again. The lock expires on
 * its own, so a replica that died holding it stalls the others for seconds, not for good.
 */
const LOCK_KEY = 'lock:boards';

/** Far longer than a write takes: only a holder that died waits it out. */
const LOCK_SECONDS = 10;

/** How long a write waits for the lock before it gives up and says so. */
const LOCK_PATIENCE_MS = 15_000;

const pause = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const locked = async <T>(kv: ActionKvStore, work: () => Promise<T>): Promise<T> => {
  const giveUpAt = Date.now() + LOCK_PATIENCE_MS;
  for (let attempt = 0; (await kv.increment(LOCK_KEY, 1, LOCK_SECONDS)) !== 1; attempt += 1) {
    if (Date.now() > giveUpAt) {
      throw new ActionRefusal('The boards are busy — try that again in a moment');
    }

    await pause(Math.min(2 + attempt * 3, 40));
  }

  try {
    return await work();
  } finally {
    await kv.delete(LOCK_KEY);
  }
};

let queue: Promise<unknown> = Promise.resolve();

const serially = <T>(kv: ActionKvStore, work: () => Promise<T>): Promise<T> => {
  const run = queue.then(
    () => locked(kv, work),
    () => locked(kv, work)
  );
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
  const board = typeof value === 'object' && value !== null ? (value as StoredBoard) : undefined;

  // Its time is up: gone, whether or not the store has let go of it yet.
  return board && !expired(board) ? board : undefined;
};

const readChat = async (kv: ActionKvStore, id: string): Promise<ChatMessage[]> => {
  const value = await kv.get(chatKey(id));

  return Array.isArray(value) ? (value as ChatMessage[]) : [];
};

const readPreview = async (kv: ActionKvStore, id: string): Promise<BoardElement[]> => {
  const value = await kv.get(previewKey(id));

  return Array.isArray(value) ? (value as BoardElement[]) : [];
};

const existing = async (kv: ActionKvStore, id: string): Promise<StoredBoard> => {
  const board = await readBoard(kv, id);
  if (!board) {
    throw new ActionRefusal('This board no longer exists');
  }

  return board;
};

/** A locked board is read only by whoever opened it: everything asked of it carries the key opening it answered. */
const assertOpen = (signer: BoardSigner, board: StoredBoard, key: unknown): void => {
  if (board.lock && !signer.keyOpens(board.id, board.lock, key)) {
    throw new ActionRefusal('This board is locked: open it with its password first');
  }
};

/**
 * What a change to a board carries: the key opening it answered, for a locked one — and the key its creator was
 * given, which a read-only board lets through.
 */
export type Pass = { key: unknown; owner?: unknown };

/**
 * Changed only by whoever may: an open board, or a locked one opened — and a read-only one only by whoever made it,
 * who made it read-only for everyone else.
 */
const assertWritable = (signer: BoardSigner, board: StoredBoard, { key, owner }: Pass): void => {
  assertOpen(signer, board, key);
  if (board.readOnly && !signer.ownerOpens(board.id, owner)) {
    throw new ActionRefusal('This board is read-only — use it as a template to get a copy you can change');
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

/**
 * What the gallery may show of a board: nothing at all of a locked one; of the rest, every frame — the shape of the
 * board — and the elements drawn last on top of them, lines thinned.
 */
const preview = (board: StoredBoard): BoardElement[] => {
  if (board.lock) {
    return [];
  }

  const shown = live(board).sort(byStacking);
  const frames = shown.filter(element => element.type === 'frame');

  return [...frames, ...shown.filter(element => element.type !== 'frame').slice(-PREVIEW_ELEMENTS)].map(element =>
    isLinear(element.type) && element.points ? { ...element, points: thin(element.points) } : element
  );
};

/** The gallery's entry for a board, replaced — and the list trimmed to what the demo keeps. */
const writeSummary = async ({ kv, assets }: BoardStores, board: StoredBoard): Promise<void> => {
  const summary: BoardSummary = {
    id: board.id,
    title: board.title,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
    count: live(board).length,
    locked: board.lock !== undefined,
    featured: board.featured === true,
    readOnly: board.readOnly === true,
    unlisted: board.unlisted === true,
    expiresAt: board.expiresAt ?? null
  };
  const others = (await readIndex(kv)).filter(entry => entry.id !== board.id);
  const index = [summary, ...others].sort((a, b) => b.updatedAt - a.updatedAt);
  // The featured boards are kept whatever else comes and goes: they are what a first visit is shown.
  const evicted = index.filter(entry => !entry.featured).slice(MAX_BOARDS - FEATURED.length);
  await Promise.all(evicted.map(entry => forget(kv, assets, entry.id)));
  await kv.set(previewKey(board.id), preview(board), lifetimeOf(board));
  const gone = new Set(evicted.map(entry => entry.id));
  await kv.set(
    INDEX_KEY,
    index.filter(entry => !gone.has(entry.id))
  );
};

/** Everything a board leaves in the stores, gone: itself, its preview, its chat, its pictures. */
const forget = async (kv: ActionKvStore, assets: AssetStore, id: string): Promise<void> => {
  await Promise.all([kv.delete(boardKey(id)), kv.delete(previewKey(id)), kv.delete(chatKey(id)), assets.forget(id)]);
};

const save = async (stores: BoardStores, board: StoredBoard): Promise<void> => {
  await stores.kv.set(boardKey(board.id), board, lifetimeOf(board));
  await writeSummary(stores, board);
};

/**
 * The featured boards, drawn once: on the first read after a start, with the ids they always have. A restart — the
 * boards are in memory — draws them again, fresh.
 */
// Raised whenever the featured boards are redrawn: a store that kept the old ones draws the new ones once.
const FEATURED_KEY = 'featured:v3';

const ensureFeatured = async (stores: BoardStores): Promise<void> => {
  const { kv } = stores;
  if (await kv.get(FEATURED_KEY)) {
    return;
  }

  await serially(kv, async () => {
    if (await kv.get(FEATURED_KEY)) {
      return;
    }

    const now = Date.now();
    for (const board of FEATURED) {
      await save(stores, {
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

/**
 * The gallery: the featured boards, and the public ones touched last, newest first — each with its preview. A
 * temporary board whose time is up is let go of here, with everything it left.
 */
export const listBoards = async (stores: BoardStores): Promise<{ featured: BoardCard[]; boards: BoardCard[] }> => {
  const { kv, assets } = stores;
  await ensureFeatured(stores);
  let index = await readIndex(kv);
  if (index.some(entry => expired(entry))) {
    index = await serially(kv, async () => {
      const current = await readIndex(kv);
      const gone = current.filter(entry => expired(entry));
      await Promise.all(gone.map(entry => forget(kv, assets, entry.id)));
      const kept = current.filter(entry => !expired(entry));
      await kv.set(INDEX_KEY, kept);

      return kept;
    });
  }

  return {
    featured: await Promise.all(index.filter(entry => entry.featured).map(entry => withPreview(kv, entry))),
    boards: await Promise.all(
      index
        .filter(entry => !entry.featured && !entry.unlisted)
        .slice(0, GALLERY_BOARDS)
        .map(entry => withPreview(kv, entry))
    )
  };
};

const opened = ({ keyFor, topicFor }: BoardSigner, board: StoredBoard, chat: ChatMessage[]): OpenedBoard => ({
  found: true,
  id: board.id,
  title: board.title,
  locked: board.lock !== undefined,
  readOnly: board.readOnly === true,
  featured: board.featured === true,
  elements: Object.values(board.elements),
  topic: topicFor(board.id, board.lock),
  key: board.lock ? keyFor(board.id, board.lock) : '',
  timer: runningTimer(board),
  unlisted: board.unlisted === true,
  expiresAt: board.expiresAt ?? null,
  chat: chat.slice(-CHAT_SERVED)
});

/**
 * A board for the first paint of its page. A locked one answers that it exists and what it is called — and nothing
 * else: its elements, its topic and its key are what opening it with the password is for.
 */
export const loadBoard = async (stores: BoardStores, id: string): Promise<OpenedBoard> => {
  await ensureFeatured(stores);
  const board = await readBoard(stores.kv, id);
  if (!board) {
    return missingBoard(id);
  }

  return board.lock
    ? {
        ...missingBoard(id),
        found: true,
        title: board.title,
        locked: true,
        readOnly: board.readOnly === true,
        featured: board.featured === true,
        expiresAt: board.expiresAt ?? null
      }
    : opened(stores.signer, board, await readChat(stores.kv, id));
};

/**
 * A locked board, opened: with its password, or with the key a page kept from the last time. Counted per visitor,
 * so guessing is slow whether the guesses are passwords or keys.
 */
export const openBoard = async (
  { kv, signer }: BoardStores,
  id: string,
  { password, key }: { password: unknown; key: unknown },
  callerId: string
): Promise<OpenedBoard> => {
  const board = await existing(kv, id);
  const chat = await readChat(kv, id);
  if (!board.lock) {
    return opened(signer, board, chat);
  }

  if (signer.keyOpens(board.id, board.lock, key)) {
    return opened(signer, board, chat);
  }

  const attempts = await kv.increment(`attempts:${id}:${callerId}:${Math.floor(Date.now() / 300_000)}`, 1, 330);
  if (attempts > ATTEMPTS_PER_WINDOW) {
    throw new ActionRefusal('Too many tries — wait a few minutes and try again');
  }

  if (typeof password !== 'string' || !password || !passwordOpens(board.lock, password)) {
    throw new ActionRefusal('That is not this board’s password');
  }

  return opened(signer, board, chat);
};

/** Who may find a board and how long it lasts, as a page asks for them: checked, and only what was asked. */
const reach = ({
  visibility,
  hours
}: {
  visibility?: unknown;
  hours?: unknown;
}): Pick<StoredBoard, 'unlisted' | 'expiresAt'> => {
  const lifetime = Number(hours);
  if (hours !== undefined && hours !== '' && !LIFETIMES.some(entry => entry === lifetime)) {
    throw new ActionRefusal(`A board lasts ${LIFETIMES.filter(Boolean).join(', ')} hours — or 0, for good`);
  }

  return {
    ...(visibility === 'private' ? { unlisted: true } : {}),
    ...(lifetime > 0 ? { expiresAt: Date.now() + lifetime * 3_600_000 } : {})
  };
};

export const createBoard = (
  stores: BoardStores,
  title: unknown,
  template: Template,
  options: { visibility?: unknown; hours?: unknown } = {}
): Promise<{ id: string; title: string; owner: string }> =>
  serially(stores.kv, async () => {
    const now = Date.now();
    const typed = typeof title === 'string' && title.trim() ? title : TEMPLATE_TITLES[template];
    const board: StoredBoard = {
      id: newBoardId(),
      title: cleanTitle(typed),
      createdAt: now,
      updatedAt: now,
      elements: Object.fromEntries(templateElements(template).map(element => [element.id, element])),
      ...reach(options)
    };
    await save(stores, board);

    return { id: board.id, title: board.title, owner: stores.signer.ownerKeyFor(board.id) };
  });

/**
 * A board of one's own, drawn like another: its elements as they are now — votes left behind, they were cast on the
 * original — and its pictures. Neither locked, read-only nor temporary, whatever the original was.
 */
export const copyBoard = (
  stores: BoardStores,
  id: string,
  key: unknown
): Promise<{ id: string; title: string; owner: string }> =>
  serially(stores.kv, async () => {
    const source = await existing(stores.kv, id);
    assertOpen(stores.signer, source, key);
    const now = Date.now();
    const elements = live(source).map(({ votes: _votes, ...element }) => element);
    const board: StoredBoard = {
      id: newBoardId(),
      title: cleanTitle(`${source.title} (copy)`),
      createdAt: now,
      updatedAt: now,
      elements: Object.fromEntries(elements.map(element => [element.id, element]))
    };
    await stores.assets.copy(
      source.id,
      board.id,
      elements.flatMap(element => (element.asset ? [element.asset] : []))
    );
    await save(stores, board);

    return { id: board.id, title: board.title, owner: stores.signer.ownerKeyFor(board.id) };
  });

/**
 * A board made read-only for everyone but whoever made it — or opened to everyone again. Only its creator may: the
 * owner key it was given is the one thing that answers. Answers the topic, where everyone on it is told.
 */
export const setReadOnly = (
  stores: BoardStores,
  id: string,
  pass: Pass,
  readOnly: unknown
): Promise<{ id: string; topic: string; readOnly: boolean }> =>
  serially(stores.kv, async () => {
    const board = await existing(stores.kv, id);
    assertOpen(stores.signer, board, pass.key);
    if (!stores.signer.ownerOpens(id, pass.owner)) {
      throw new ActionRefusal('Only whoever made this board can make it read-only');
    }

    const on = readOnly === true || readOnly === 'true';
    const { readOnly: _previous, ...rest } = board;
    await save(stores, { ...rest, ...(on ? { readOnly: true } : {}), updatedAt: Date.now() });

    return { id, topic: stores.signer.topicFor(id, board.lock), readOnly: on };
  });

export const renameBoard = (
  stores: BoardStores,
  id: string,
  title: unknown,
  pass: Pass
): Promise<{ id: string; title: string; topic: string }> =>
  serially(stores.kv, async () => {
    const board = await existing(stores.kv, id);
    assertWritable(stores.signer, board, pass);
    const renamed = { ...board, title: cleanTitle(title), updatedAt: Date.now() };
    await save(stores, renamed);

    return { id, title: renamed.title, topic: stores.signer.topicFor(id, board.lock) };
  });

/**
 * A password set, changed or — given none — removed. Answers the new key and topic, and the topic the board had,
 * which is where everyone still on it is told: their key no longer opens it.
 */
export const lockBoard = (
  stores: BoardStores,
  id: string,
  password: unknown,
  pass: Pass
): Promise<{ id: string; locked: boolean; wasLocked: boolean; key: string; topic: string; previousTopic: string }> =>
  serially(stores.kv, async () => {
    const { keyFor, topicFor } = stores.signer;
    const board = await existing(stores.kv, id);
    assertWritable(stores.signer, board, pass);
    const text = typeof password === 'string' ? password : '';
    const problem = text ? passwordProblem(text) : undefined;
    if (problem) {
      throw new ActionRefusal(problem);
    }

    const previousTopic = topicFor(id, board.lock);
    const { lock: _previous, ...rest } = board;
    const next: StoredBoard = text ? { ...rest, lock: lockWith(text, board.lock) } : rest;
    await save(stores, { ...next, updatedAt: Date.now() });

    return {
      id,
      locked: next.lock !== undefined,
      // What the page says depends on it: a password set, changed — or removed, which only a board that had one can be.
      wasLocked: board.lock !== undefined,
      key: next.lock ? keyFor(id, next.lock) : '',
      topic: topicFor(id, next.lock),
      previousTopic
    };
  });

/**
 * A board gone, with its preview, its place in the gallery and its pictures. Answers the topic it went by, which is
 * where everyone still on it is told — and sent back to the boards.
 */
export const deleteBoard = (stores: BoardStores, id: string, pass: Pass): Promise<{ id: string; topic: string }> =>
  serially(stores.kv, async () => {
    const { kv, assets, signer } = stores;
    const board = await existing(kv, id);
    assertWritable(signer, board, pass);
    await forget(kv, assets, id);
    await kv.set(
      INDEX_KEY,
      (await readIndex(kv)).filter(entry => entry.id !== id)
    );

    return { id, topic: signer.topicFor(id, board.lock) };
  });

/** A commit arrives as the flow sent it: the elements themselves, or their JSON. */
const elementsOf = (ops: unknown): BoardElement[] => {
  let value = ops;
  if (typeof ops === 'string') {
    try {
      value = JSON.parse(ops) as unknown;
    } catch {
      throw new ActionRefusal('A commit is a list of elements');
    }
  }

  if (!Array.isArray(value) || !value.length || value.length > LIMITS.ops) {
    throw new ActionRefusal(`A commit is a list of 1 to ${LIMITS.ops} elements`);
  }

  const elements = value.map(parseElement);
  const invalid = elements.findIndex(element => !element);
  if (invalid !== -1) {
    throw new ActionRefusal(`Element ${invalid + 1} of the commit is not a board element`);
  }

  return elements.filter(element => element !== undefined);
};

/**
 * The votes on an element and the replies on a comment are the server's: whatever a commit says about them, the ones
 * kept stand.
 */
const withKept = (element: BoardElement, kept: BoardElement | undefined): BoardElement => {
  const { votes: _votes, replies: _replies, ...rest } = element;

  return {
    ...rest,
    ...(kept?.votes?.length ? { votes: kept.votes } : {}),
    ...(kept?.replies?.length ? { replies: kept.replies } : {})
  };
};

/**
 * One commit: validated, merged element by element, kept — and answered with what each element it touched now is,
 * for the action to announce on the board's channel.
 *
 * All or nothing: a commit with one malformed element is refused whole, because a partial one is a drawing half-moved.
 */
export const applyToBoard = async (
  stores: BoardStores,
  id: string,
  ops: unknown,
  callerId: string,
  pass: Pass
): Promise<{ settled: BoardElement[]; topic: string }> => {
  const { kv, signer } = stores;
  const incoming = elementsOf(ops);
  const commits = await kv.increment(`rate:${callerId}:${Math.floor(Date.now() / 10_000)}`, 1, 20);
  if (commits > COMMITS_PER_WINDOW) {
    throw new ActionRefusal('Too many changes at once — slow down for a moment');
  }

  return serially(kv, async () => {
    const board = await existing(kv, id);
    assertWritable(signer, board, pass);
    const merged = mergeElements(
      board.elements,
      incoming.map(element => withKept(element, board.elements[element.id]))
    );
    if (Object.keys(merged.board).length > LIMITS.elements) {
      throw new ActionRefusal(`A board holds at most ${LIMITS.elements} elements`);
    }

    await save(stores, { ...board, elements: merged.board, updatedAt: Date.now() });

    return { settled: merged.settled, topic: signer.topicFor(id, board.lock) };
  });
};

/**
 * A vote for an element, or a vote taken back — the element announced with its votes as they now are. Done here, one
 * at a time, rather than as a commit: two people voting in the same instant would each send the element with only
 * their own vote on it, and one of them would win.
 */
export const voteOn = (
  stores: BoardStores,
  id: string,
  elementId: unknown,
  voter: unknown,
  pass: Pass
): Promise<{ settled: BoardElement[]; topic: string }> =>
  serially(stores.kv, async () => {
    const board = await existing(stores.kv, id);
    assertWritable(stores.signer, board, pass);
    const element = typeof elementId === 'string' ? board.elements[elementId] : undefined;
    if (!element || element.deleted || isLinear(element.type)) {
      throw new ActionRefusal('There is nothing to vote for there');
    }

    if (!isVoterId(voter)) {
      throw new ActionRefusal('A vote needs the id this visitor keeps');
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
    await save(stores, { ...board, elements: { ...board.elements, [voted.id]: voted }, updatedAt: Date.now() });

    return { settled: [voted], topic: stores.signer.topicFor(id, board.lock) };
  });

/** A countdown started — or, at zero, stopped — for everyone on the board. */
export const setTimer = (
  stores: BoardStores,
  id: string,
  seconds: unknown,
  pass: Pass
): Promise<{ board: string; timer: BoardTimer | null; topic: string }> =>
  serially(stores.kv, async () => {
    const board = await existing(stores.kv, id);
    assertWritable(stores.signer, board, pass);
    const span = Math.round(Number(seconds));
    if (!Number.isFinite(span) || span < 0 || span > MAX_TIMER_SECONDS) {
      throw new ActionRefusal(`A timer runs from 1 second to ${MAX_TIMER_SECONDS / 60} minutes`);
    }

    const { timer: _previous, ...rest } = board;
    const timer = span ? { endsAt: Date.now() + span * 1000, seconds: span } : null;
    await save(stores, timer ? { ...rest, timer } : rest);

    return { board: id, timer, topic: stores.signer.topicFor(id, board.lock) };
  });

/** A picture for the board, kept beside it: answers the asset id the image element names. */
export const uploadToBoard = async (
  { kv, assets, signer }: BoardStores,
  id: string,
  data: unknown,
  pass: Pass
): Promise<{ asset: string }> => {
  const board = await existing(kv, id);
  assertWritable(signer, board, pass);

  return { asset: await keepAsset(assets, id, data) };
};

/**
 * Who may find a board — everyone, from the front page, or only whoever has the link — and how long it lasts: for
 * good, or a few hours from now, after which it is gone for everyone. Answers the topic, where everyone on it is told.
 */
export const setReach = (
  stores: BoardStores,
  id: string,
  pass: Pass,
  choice: { visibility: unknown; hours: unknown }
): Promise<{ id: string; topic: string; unlisted: boolean; expiresAt: number | null }> =>
  serially(stores.kv, async () => {
    const board = await existing(stores.kv, id);
    assertWritable(stores.signer, board, pass);
    const { unlisted: _unlisted, expiresAt: _expiresAt, ...rest } = board;
    // A lifetime left as it was is not restarted: "5 hours" chosen again does not add five more.
    const kept = choice.hours === 'keep' ? { ...(board.expiresAt ? { expiresAt: board.expiresAt } : {}) } : {};
    const next: StoredBoard = {
      ...rest,
      ...reach({ visibility: choice.visibility, hours: choice.hours === 'keep' ? undefined : choice.hours }),
      ...kept,
      updatedAt: Date.now()
    };
    await save(stores, next);

    return {
      id,
      topic: stores.signer.topicFor(id, board.lock),
      unlisted: next.unlisted === true,
      expiresAt: next.expiresAt ?? null
    };
  });

/** One line of the board's chat, kept with the last ones and answered for the channel to carry to everyone. */
export const sayOn = async (
  stores: BoardStores,
  id: string,
  pass: Pass,
  said: { name: unknown; color: unknown; text: unknown; by: unknown; agent?: unknown },
  callerId: string
): Promise<{ message: ChatMessage; topic: string }> => {
  const { kv, signer } = stores;
  const text = typeof said.text === 'string' ? said.text.trim().slice(0, 500) : '';
  if (!text) {
    throw new ActionRefusal('Say something first');
  }

  const lines = await kv.increment(`chat-rate:${callerId}:${Math.floor(Date.now() / 10_000)}`, 1, 20);
  if (lines > CHATS_PER_WINDOW) {
    throw new ActionRefusal('That is a lot at once — give the others a moment');
  }

  return serially(kv, async () => {
    const board = await existing(kv, id);
    // Talking about a board is not changing it: a read-only one has a chat too.
    assertOpen(signer, board, pass.key);
    const message: ChatMessage = {
      id: newBoardId(),
      name: typeof said.name === 'string' && said.name.trim() ? said.name.trim().slice(0, 24) : 'Someone',
      color: typeof said.color === 'string' ? said.color.slice(0, 16) : '',
      text,
      at: Date.now(),
      by: typeof said.by === 'string' ? said.by.slice(0, 32) : '',
      ...(said.agent === true || said.agent === 'true' ? { agent: true } : {})
    };
    await kv.set(chatKey(id), [...(await readChat(kv, id)), message].slice(-CHAT_KEPT), lifetimeOf(board));

    return { message, topic: signer.topicFor(id, board.lock) };
  });
};

/**
 * An answer in a comment's thread, added on the server — one at a time, as votes are — and the comment announced with
 * its thread as it now is.
 */
export const replyTo = (
  stores: BoardStores,
  id: string,
  pass: Pass,
  { element: elementId, author, text }: { element: unknown; author: unknown; text: unknown }
): Promise<{ settled: BoardElement[]; topic: string }> =>
  serially(stores.kv, async () => {
    const board = await existing(stores.kv, id);
    assertWritable(stores.signer, board, pass);
    const comment = typeof elementId === 'string' ? board.elements[elementId] : undefined;
    if (comment?.type !== 'comment' || comment.deleted) {
      throw new ActionRefusal('There is no comment there to answer');
    }

    const said = typeof text === 'string' ? text.trim().slice(0, LIMITS.text) : '';
    if (!said) {
      throw new ActionRefusal('Write an answer first');
    }

    const reply = {
      author: typeof author === 'string' && author.trim() ? author.trim().slice(0, LIMITS.author) : 'Someone',
      text: said,
      at: Date.now()
    };
    const answered: BoardElement = {
      ...comment,
      replies: [...(comment.replies ?? []), reply].slice(-LIMITS.replies),
      version: comment.version + 1,
      nonce: randomInt(2 ** 31)
    };
    await save(stores, { ...board, elements: { ...board.elements, [answered.id]: answered }, updatedAt: Date.now() });

    return { settled: [answered], topic: stores.signer.topicFor(id, board.lock) };
  });
