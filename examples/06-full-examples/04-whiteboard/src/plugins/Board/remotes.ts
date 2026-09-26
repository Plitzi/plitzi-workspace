import { parseElement } from '../../board/model.ts';
import { isDefined, isFiniteNumber, isPoint } from './values.ts';

import type { View } from './types.ts';
import type { BoardElement, Point } from '../../board/model.ts';

/**
 * The others on the board, as this page last heard them: where their pointer is, what they drag and select, what they
 * look at and what they say. Nothing here is kept — it is the room's pointer traffic, folded in as it arrives.
 */

export type Remote = {
  cursor?: Point;
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

export const isView = (value: unknown): value is View =>
  Array.isArray(value) && value.length === 4 && value.every(isFiniteNumber);

/** What one pointer message changed that the canvas acts on beyond drawing it. */
export type Heard = { remote: Remote; laserAt?: Point; view?: View };

/** `later` asks for a frame after a delay: something heard now fades on its own clock. */
export const createRemotes = (later: (ms: number) => void) => {
  const remotes = new Map<string, Remote>();

  const hear = (from: string, data: object): Heard => {
    const remote = remotes.get(from) ?? { heardAt: 0, draft: new Map<string, BoardElement>(), selection: [] };
    remotes.set(from, remote);
    remote.heardAt = Date.now();
    let laserAt: Point | undefined;
    if ('x' in data && 'y' in data && isPoint([data.x, data.y])) {
      remote.cursor = [Number(data.x), Number(data.y)];
      if ('laser' in data && data.laser === true) {
        laserAt = remote.cursor;
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

    if ('draft' in data && Array.isArray(data.draft)) {
      remote.draft = new Map(
        data.draft
          .slice(0, 100)
          .map(parseElement)
          .filter(isDefined)
          .map(element => [element.id, element])
      );
      remote.draftEndedAt = undefined;
    } else if (remote.draft.size && remote.draftEndedAt === undefined) {
      remote.draftEndedAt = Date.now();
      later(REMOTE_DRAFT_GRACE_MS + 50);
    }

    return { remote, ...(laserAt ? { laserAt } : {}), ...(view ? { view } : {}) };
  };

  /** What remote drafts still show: until the server's answer is at least as new, or the grace is over. */
  const drafts = (now: number, versionOf: (id: string) => number): BoardElement[] => {
    const shown: BoardElement[] = [];
    for (const remote of remotes.values()) {
      if (remote.draftEndedAt !== undefined && now - remote.draftEndedAt > REMOTE_DRAFT_GRACE_MS) {
        remote.draft.clear();
        remote.draftEndedAt = undefined;
      }

      for (const element of remote.draft.values()) {
        if (versionOf(element.id) < element.version) {
          shown.push(element);
        }
      }
    }

    return shown;
  };

  /** A member's cursor worth drawing — somebody who moved it lately — and what they are saying at it. */
  const cursorOf = (remote: Remote, now: number): { at: Point; saying?: string } | undefined => {
    if (!remote.cursor || now - remote.heardAt >= CURSOR_IDLE_MS) {
      return undefined;
    }

    const saying =
      remote.chat && (remote.chatEndedAt === undefined || now - remote.chatEndedAt < CHAT_LINGER_MS)
        ? remote.chat
        : undefined;

    return { at: remote.cursor, ...(saying ? { saying } : {}) };
  };

  /** Forgets whoever left the room. */
  const keepOnly = (present: (from: string) => boolean): void => {
    for (const from of remotes.keys()) {
      if (!present(from)) {
        remotes.delete(from);
      }
    }
  };

  return {
    hear,
    drafts,
    cursorOf,
    keepOnly,
    entries: () => remotes.entries(),
    viewOf: (from: string): View | undefined => remotes.get(from)?.view,
    clear: () => remotes.clear()
  };
};

export type Remotes = ReturnType<typeof createRemotes>;
