import { randomInt } from 'node:crypto';

import { byStacking, parseElement, supersedes } from '../board/model.ts';
import { connect } from './connection.ts';

import type { Connection, Heard } from './connection.ts';
import type { ChatMessage, OpenedBoard } from '../board/store.ts';
import type { BoardElement, Point } from '../board/model.ts';

/**
 * An agent on one board: what it knows of the board, and how it acts on it — the way a page does.
 *
 * It reads the board through the action a page opens a locked board with (`board-open`, which answers an open board as
 * it is), keeps it current from the board's channel, commits through `board-apply`, and is on the room with a name, a
 * colour and a cursor: the people on the board see it arrive, point, write and speak. What it hears — lines of chat,
 * words at a cursor, changes made by the others — is kept for `wait_for_activity` to hand over.
 */

export type Activity =
  | { kind: 'chat'; name: string; text: string; at: number }
  | { kind: 'said'; name: string; text: string; at: number }
  | { kind: 'changed'; name: string; count: number; at: number }
  | { kind: 'joined' | 'left'; name: string; at: number };

type Member = { name: string; color: string; agent: boolean };

export type Session = Awaited<ReturnType<typeof joinBoard>>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** An element's id, as the canvas makes them. */
export const newElementId = (): string =>
  Array.from(
    { length: 12 },
    () => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[randomInt(62)]
  ).join('');

/** A board link, a bare id, or an id with the server beside it — as a person pastes one to an agent. */
export const parseLink = (link: string, fallbackOrigin: string): { origin: string; board: string } => {
  const trimmed = link.trim();
  const bare = /^[a-z0-9]{10}$/.exec(trimmed);
  if (bare) {
    return { origin: fallbackOrigin, board: trimmed };
  }

  const url = new URL(trimmed);
  const match = /\/b\/([a-z0-9]{10})/.exec(url.pathname);
  if (!match) {
    throw new Error('That is not a board link: it looks like https://…/b/abcd234xyz');
  }

  return { origin: url.origin, board: match[1] };
};

/** One call to a server action, as a page makes it: its answer, or what went wrong, in the server's words. */
export const callAction = async (
  origin: string,
  actionId: string,
  input: Record<string, unknown>
): Promise<unknown> => {
  const response = await fetch(new URL('/_action', origin), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actionId, input })
  });
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok || !isRecord(body)) {
    const error = isRecord(body) && typeof body.error === 'string' ? body.error : `${response.status}`;
    throw new Error(`${actionId}: ${error}`);
  }

  // A run that failed is still a 200: its status says so, and `error` says why when the board refused on purpose —
  // a read-only board, a commit too large — which is what the agent needs to hear to try something else.
  if (body.status === 'failed') {
    throw new Error(`${actionId}: ${typeof body.error === 'string' ? body.error : 'the server could not do it'}`);
  }

  return body.output;
};

const isOpened = (value: unknown): value is OpenedBoard =>
  isRecord(value) && typeof value.id === 'string' && typeof value.found === 'boolean' && Array.isArray(value.elements);

export const joinBoard = async (
  { origin, board }: { origin: string; board: string },
  { name, color, password }: { name: string; color: string; password?: string }
) => {
  // `board-open` answers an open board as it is, and a locked one once its password is right: one door for both.
  const loaded = await callAction(origin, 'board-open', { id: board, password: password ?? '', key: '' });
  if (!isOpened(loaded) || !loaded.found) {
    throw new Error('There is no board there — it may have been deleted, or its time ran out');
  }

  if (loaded.locked && !loaded.topic) {
    throw new Error('This board is locked: join it again with its password');
  }

  const elements = new Map<string, BoardElement>();
  for (const element of loaded.elements.map(parseElement)) {
    if (element) {
      elements.set(element.id, element);
    }
  }

  const members = new Map<string, Member>();
  const chat: ChatMessage[] = [...loaded.chat];
  const activity: Activity[] = [];
  const waiters = new Set<() => void>();
  let title = loaded.title;
  /** What this agent committed, as the server will announce it back: its own changes are not news to it. */
  const own = new Set<string>();
  const stampOf = (element: BoardElement): string => `${element.id}:${element.version}:${element.nonce}`;
  let gone = false;
  let cursor: Point = [0, 0];

  const note = (entry: Activity): void => {
    activity.push(entry);
    if (activity.length > 200) {
      activity.shift();
    }

    waiters.forEach(wake => wake());
  };

  const nameOf = (from: string): string => members.get(from)?.name ?? 'Someone';

  const hear = ({ topic, type, from, data, mine }: Heard): void => {
    if (mine) {
      return;
    }

    if (topic.startsWith('board:')) {
      if (type === 'elements' && Array.isArray(data)) {
        let changed = 0;
        for (const element of data.map(parseElement)) {
          if (element && supersedes(element, elements.get(element.id))) {
            elements.set(element.id, element);
            changed += own.delete(stampOf(element)) ? 0 : 1;
          } else if (element) {
            own.delete(stampOf(element));
          }
        }

        if (changed) {
          note({ kind: 'changed', name: 'the board', count: changed, at: Date.now() });
        }
      } else if (type === 'chat' && isRecord(data) && typeof data.text === 'string') {
        const line: ChatMessage = {
          id: String(data.id ?? ''),
          name: String(data.name ?? 'Someone'),
          color: String(data.color ?? ''),
          text: data.text,
          at: Number(data.at ?? Date.now()),
          by: String(data.by ?? ''),
          ...(data.agent === true ? { agent: true } : {})
        };
        chat.push(line);
        if (!line.agent || line.name !== name) {
          note({ kind: 'chat', name: line.name, text: line.text, at: line.at });
        }
      } else if (type === 'title' && isRecord(data) && typeof data.title === 'string') {
        title = data.title;
      } else if (type === 'deleted') {
        gone = true;
        note({ kind: 'left', name: 'The board was deleted', at: Date.now() });
      }

      return;
    }

    // The room: who is here, and what they say at their cursors.
    if (type === '$presence' && isRecord(data) && typeof data.name === 'string') {
      const known = members.has(from);
      members.set(from, { name: data.name, color: String(data.color ?? ''), agent: data.agent === true });
      if (!known) {
        note({ kind: 'joined', name: data.name, at: Date.now() });
      }
    } else if (type === '$leave') {
      const member = members.get(from);
      members.delete(from);
      if (member) {
        note({ kind: 'left', name: member.name, at: Date.now() });
      }
    } else if (type === 'pointer' && isRecord(data) && typeof data.chat === 'string' && data.chat.trim()) {
      // Cursor chat arrives as it is typed: only a pause — a line that stopped growing — is worth handing over.
      const last = activity.at(-1);
      if (last?.kind === 'said' && last.name === nameOf(from)) {
        last.text = data.chat;
        last.at = Date.now();
      } else {
        note({ kind: 'said', name: nameOf(from), text: data.chat, at: Date.now() });
      }
    }
  };

  const topics = [`board:${loaded.topic}`, `room:${loaded.topic}`];
  const self = { name, color, agent: true };
  let connection: Connection = await connect(origin, topics, heard => hear(heard));
  connection.announce(`room:${loaded.topic}`, self);

  /** A dropped socket is reopened before anything is said on it. */
  const live = async (): Promise<Connection> => {
    if (connection.closed) {
      connection = await connect(origin, topics, heard => hear(heard));
      connection.announce(`room:${loaded.topic}`, self);
    }

    return connection;
  };

  const shown = (): BoardElement[] => [...elements.values()].filter(element => !element.deleted).sort(byStacking);

  /** Where the others see this agent look: a box around what it is working on. */
  const viewAround = ([x, y]: Point): [number, number, number, number] => [
    Math.round(x - 700),
    Math.round(y - 420),
    1400,
    840
  ];

  /** What this agent says at its cursor, and until when — carried by every move, so a dropped message loses nothing. */
  let saying = { text: '', until: 0 };

  const pointer = async (at: Point, extra: Record<string, unknown> = {}): Promise<void> => {
    cursor = at;
    await (
      await live()
    ).publish(`room:${loaded.topic}`, 'pointer', {
      x: Math.round(at[0]),
      y: Math.round(at[1]),
      draft: null,
      selection: [],
      view: viewAround(at),
      chat: Date.now() < saying.until ? saying.text : '',
      ...extra
    });
  };

  /** The cursor, moved as a hand moves it — a few steps along the way, so the others can follow it. */
  const glide = async (to: Point, extra: Record<string, unknown> = {}): Promise<void> => {
    const from = cursor;
    const steps = 10;
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      const eased = 1 - (1 - t) ** 3;
      await pointer([from[0] + (to[0] - from[0]) * eased, from[1] + (to[1] - from[1]) * eased], extra);
      await new Promise(resolve => setTimeout(resolve, 35));
    }
  };

  /** Changes kept by the server and announced to everyone — each a new version of what this agent last heard. */
  const commit = async (changes: BoardElement[]): Promise<BoardElement[]> => {
    if (gone) {
      throw new Error('This board was deleted');
    }

    const stamped = changes.map(change => ({
      ...change,
      version: (elements.get(change.id)?.version ?? 0) + 1,
      nonce: randomInt(2 ** 31)
    }));
    stamped.forEach(element => own.add(stampOf(element)));
    await callAction(origin, 'board-apply', { board, key: loaded.key, ops: stamped });
    stamped.forEach(element => elements.set(element.id, element));

    return stamped;
  };

  return {
    board,
    origin,
    link: new URL(`/b/${board}`, origin).href,
    key: loaded.key,
    readOnly: loaded.readOnly,
    get title() {
      return title;
    },
    get gone() {
      return gone;
    },
    get cursor() {
      return cursor;
    },
    name,
    color,
    elements: shown,
    element: (id: string): BoardElement | undefined => {
      const found = elements.get(id);

      return found && !found.deleted ? found : undefined;
    },
    topZ: (): number => Math.max(0, ...[...elements.values()].map(element => element.z)),
    members: (): Member[] => [...members.values()],
    chat: (): ChatMessage[] => chat.slice(-30),
    commit,
    pointer,
    glide,
    /** Words at this agent's cursor, for a few seconds — then gone, as a person's cursor chat is. */
    sayAtCursor: async (text: string): Promise<void> => {
      saying = { text: text.slice(0, 160), until: Date.now() + 5000 };
      await pointer(cursor);
      // Said once more when its time is up, as empty: the words fade on the others' screens.
      setTimeout(() => void pointer(cursor), 5100);
    },
    /** A line in the board's chat, kept with the board, marked as an agent's. */
    chatLine: async (text: string): Promise<void> => {
      await callAction(origin, 'board-chat', { board, key: loaded.key, name, color, text, by: '', agent: 'true' });
    },
    react: async (emoji: string): Promise<void> => {
      await (await live()).publish(`room:${loaded.topic}`, 'reaction', { emoji, x: cursor[0], y: cursor[1] });
    },
    reply: async (element: string, text: string): Promise<void> => {
      await callAction(origin, 'board-reply', { board, key: loaded.key, element, author: name, text });
    },
    /** What happened since `since`: as soon as there is anything, or when `ms` have passed with nothing. */
    activitySince: async (since: number, ms: number): Promise<Activity[]> => {
      const fresh = (): Activity[] => activity.filter(entry => entry.at > since);
      if (!fresh().length && ms > 0) {
        await new Promise<void>(resolve => {
          const timeout = setTimeout(done, ms);
          function done(): void {
            clearTimeout(timeout);
            waiters.delete(done);
            // A moment for whoever is typing at their cursor to finish the line.
            setTimeout(resolve, 1200);
          }
          waiters.add(done);
        });
      }

      return fresh();
    },
    leave: (): void => connection.close()
  };
};
