import { isDefined, isFiniteNumber, isPoint } from './values.ts';
import { parseElement } from '../../board/model.ts';

import type { View } from './types.ts';
import type { BoardElement, Point } from '../../board/model.ts';

/**
 * The others on the board, as this page last heard them: where their pointer is, what they drag and select, what they
 * look at and what they say. Nothing here is kept — it is the room's pointer traffic, folded in as it arrives.
 */

/** Where a cursor was, and when — by the sender's clock, read on this one. */
type Sample = { at: Point; time: number };

/**
 * What a message said about the hand, due when the cursor gets there: what it held — nothing, when `draft` is absent
 * — and where its laser was. Shown at once, a note dragged would run ahead of the cursor dragging it.
 */
type Due = { time: number; draft?: BoardElement[]; laser?: Point };

export type Remote = {
  /** The cursor's last few places, oldest first: it is drawn a moment behind, moving along them. */
  path: Sample[];
  /** The sender's clock, as this one reads it: the least it has been behind — the message that came fastest. */
  clock?: number;
  /** What the hand did, waiting for the cursor to be drawn there. */
  due: Due[];
  heardAt: number;
  draft: Map<string, BoardElement>;
  /** When the member's drag ended: its draft is drawn until the server's answer catches up, or this long after. */
  draftEndedAt?: number;
  selection: string[];
  /** What the member is looking at, for following them. */
  view?: View;
  /** What they are saying at their cursor, and when they stopped — it lingers a moment after. */
  chat?: string;
  chatEndedAt?: number;
};

/** How long cursor chat stays on another screen once its writer closed it. */
const CHAT_LINGER_MS = 3500;

const REMOTE_DRAFT_GRACE_MS = 1500;

/** A cursor nobody has moved for this long is somebody who walked away: it stops being drawn. */
const CURSOR_IDLE_MS = 60_000;

/**
 * How far behind the others' cursors are drawn. A pointer is heard twenty times a second, and never evenly: chased as
 * each message came, a cursor moved in spurts — fast when one arrived, slowing until the next. Drawn this far in the
 * past, by the time each place was SENT, there is always a place ahead to move toward, and a message late by less
 * than this changes nothing on screen: the hand moves as it moved.
 */
const CURSOR_DELAY_MS = 100;

/** A pointer quiet this long starts a new stream: its clock is read afresh, whatever the network did meanwhile. */
const CURSOR_RESYNC_MS = 1000;

/** Places kept per cursor: enough to span the delay, and the curve through the places either side of it. */
const CURSOR_SAMPLES = 8;

/** Past this far (board units) a cursor is somewhere else altogether, not moving: it is drawn there at once. */
const CURSOR_LEAP = 1500;

/** Where a cursor is `t` of the way from `p1` to `p2`, on a curve through the places either side — never a corner. */
const catmullRom = (p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point => {
  const axis = (index: 0 | 1): number =>
    0.5 *
    (2 * p1[index] +
      (p2[index] - p0[index]) * t +
      (2 * p0[index] - 5 * p1[index] + 4 * p2[index] - p3[index]) * t ** 2 +
      (3 * p1[index] - p0[index] - 3 * p2[index] + p3[index]) * t ** 3);

  return [axis(0), axis(1)];
};

export const isView = (value: unknown): value is View =>
  Array.isArray(value) && value.length === 4 && value.every(isFiniteNumber);

/** What one pointer message changed that the canvas acts on beyond drawing it. */
export type Heard = { remote: Remote; view?: View };

/** `later` asks for a frame after a delay: something heard now fades on its own clock. */
export const createRemotes = (later: (ms: number) => void) => {
  const remotes = new Map<string, Remote>();
  /** Counts every change to what the others are dragging — the drawn board depends on it, their cursors do not. */
  let draftRevision = 0;
  /** The others' laser, where it has been drawn to since the canvas last took it. */
  let lasers: { from: string; at: Point }[] = [];

  /**
   * A place the cursor was, into its path at the time it was sent. A cursor quiet for a while carries on from where it
   * stopped; one that leapt starts over there.
   */
  const follow = (remote: Remote, at: Point, time: number, quiet: boolean): void => {
    const last = remote.path.at(-1);
    if (!last || Math.hypot(at[0] - last.at[0], at[1] - last.at[1]) > CURSOR_LEAP) {
      remote.path = [{ at, time }];
    } else if (quiet) {
      remote.path = [
        { at: last.at, time: time - CURSOR_DELAY_MS / 2 },
        { at, time }
      ];
    } else {
      remote.path = [...remote.path, { at, time }].slice(-CURSOR_SAMPLES);
    }
  };

  const hear = (from: string, data: object): Heard => {
    const remote = remotes.get(from) ?? {
      path: [],
      due: [],
      heardAt: 0,
      draft: new Map<string, BoardElement>(),
      selection: []
    };
    remotes.set(from, remote);
    const now = Date.now();
    const quiet = now - remote.heardAt >= CURSOR_RESYNC_MS;
    remote.heardAt = now;
    const sent = 'sentAt' in data && isFiniteNumber(data.sentAt) ? data.sentAt : now;
    remote.clock = quiet || remote.clock === undefined ? now - sent : Math.min(remote.clock, now - sent);
    // A message overtaken by the next is drawn after it, never back in time.
    const time = Math.max(sent + remote.clock, (remote.due.at(-1)?.time ?? 0) + 1, (remote.path.at(-1)?.time ?? 0) + 1);
    let laser: Point | undefined;
    if ('x' in data && 'y' in data && isPoint([data.x, data.y])) {
      const at: Point = [Number(data.x), Number(data.y)];
      follow(remote, at, time, quiet);
      if ('laser' in data && data.laser === true) {
        laser = at;
      }
    }

    if ('chat' in data && typeof data.chat === 'string') {
      if (data.chat) {
        remote.chat = data.chat.slice(0, 160);
        remote.chatEndedAt = undefined;
      } else if (remote.chat && remote.chatEndedAt === undefined) {
        remote.chatEndedAt = Date.now();
        later(CHAT_LINGER_MS + 50);
      }
    }

    const view = 'view' in data && isView(data.view) ? data.view : undefined;
    if (view) {
      remote.view = view;
    }

    if ('selection' in data && Array.isArray(data.selection)) {
      remote.selection = data.selection.filter((id): id is string => typeof id === 'string').slice(0, 50);
    }

    const draft =
      'draft' in data && Array.isArray(data.draft)
        ? data.draft.slice(0, 100).map(parseElement).filter(isDefined)
        : undefined;
    remote.due.push({ time, ...(draft ? { draft } : {}), ...(laser ? { laser } : {}) });
    // Drawn when the cursor gets there, which a frame asked for now may be too early to see.
    later(CURSOR_DELAY_MS + 20);

    return { remote, ...(view ? { view } : {}) };
  };

  /** What the hand held, when the cursor gets to where it held it. */
  const hold = (remote: Remote, draft: readonly BoardElement[] | undefined, now: number): void => {
    if (draft) {
      // An empty draft over an empty one — a pointer moving with nothing in hand — changes nothing drawn.
      if (draft.length || remote.draft.size) {
        draftRevision += 1;
      }

      remote.draft = new Map(draft.map(element => [element.id, element]));
      remote.draftEndedAt = undefined;
    } else if (remote.draft.size && remote.draftEndedAt === undefined) {
      remote.draftEndedAt = now;
      later(REMOTE_DRAFT_GRACE_MS + 50);
    }
  };

  /**
   * The others' hands brought up to what is drawn now: what each held and where its laser was, as its cursor reaches
   * the place; and drafts whose grace is over let go — the server's answer has had its time to arrive.
   */
  const advance = (now: number): void => {
    const shown = now - CURSOR_DELAY_MS;
    for (const [from, remote] of remotes) {
      let reached = 0;
      while (reached < remote.due.length && remote.due[reached].time <= shown) {
        const { draft, laser } = remote.due[reached];
        hold(remote, draft, now);
        if (laser) {
          lasers.push({ from, at: laser });
        }

        reached += 1;
      }

      if (reached) {
        remote.due = remote.due.slice(reached);
      }

      if (remote.draftEndedAt !== undefined && now - remote.draftEndedAt > REMOTE_DRAFT_GRACE_MS) {
        if (remote.draft.size) {
          draftRevision += 1;
        }

        remote.draft.clear();
        remote.draftEndedAt = undefined;
      }
    }
  };

  /** Where the others' lasers have been since this was last asked: the trail each leaves, to be drawn once. */
  const takeLasers = (): { from: string; at: Point }[] => {
    const taken = lasers;
    lasers = [];

    return taken;
  };

  /** What remote drafts still show: until the server's answer is at least as new, or the grace is over. */
  const drafts = (now: number, versionOf: (id: string) => number): BoardElement[] => {
    advance(now);
    const shown: BoardElement[] = [];
    for (const remote of remotes.values()) {
      for (const element of remote.draft.values()) {
        if (versionOf(element.id) < element.version) {
          shown.push(element);
        }
      }
    }

    return shown;
  };

  /** Every element somebody else is dragging right now — whatever their draft says of where it is. */
  const draftIds = (): string[] => [...remotes.values()].flatMap(remote => [...remote.draft.keys()]);

  /**
   * A member's cursor worth drawing — somebody who moved it lately — where it is on its way to, and what they are
   * saying at it. `moving` while it has not caught up: the canvas draws again until it has.
   */
  const cursorOf = (remote: Remote, now: number): { at: Point; moving: boolean; saying?: string } | undefined => {
    const { path } = remote;
    const newest = path.at(-1);
    if (!newest || now - remote.heardAt >= CURSOR_IDLE_MS) {
      return undefined;
    }

    const shown = now - CURSOR_DELAY_MS;
    const next = path.findIndex(sample => sample.time > shown);
    let at = newest.at;
    if (next === 0) {
      at = path[0].at;
    } else if (next > 0) {
      const [before, after] = [path[next - 1], path[next]];
      const t = (shown - before.time) / (after.time - before.time);
      at = catmullRom((path[next - 2] ?? before).at, before.at, after.at, (path[next + 1] ?? after).at, t);
    }

    const moving = shown < newest.time;

    const saying =
      remote.chat && (remote.chatEndedAt === undefined || now - remote.chatEndedAt < CHAT_LINGER_MS)
        ? remote.chat
        : undefined;

    return { at, moving, ...(saying ? { saying } : {}) };
  };

  /** Forgets whoever left the room. */
  const keepOnly = (present: (from: string) => boolean): void => {
    for (const [from, remote] of remotes) {
      if (!present(from)) {
        if (remote.draft.size) {
          draftRevision += 1;
        }

        remotes.delete(from);
      }
    }
  };

  return {
    hear,
    drafts,
    advance,
    takeLasers,
    draftIds,
    get draftRevision() {
      return draftRevision;
    },
    cursorOf,
    keepOnly,
    entries: () => remotes.entries(),
    viewOf: (from: string): View | undefined => remotes.get(from)?.view,
    clear: () => remotes.clear()
  };
};

export type Remotes = ReturnType<typeof createRemotes>;
