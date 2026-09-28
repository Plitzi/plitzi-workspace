import { randomInt } from 'node:crypto';

import { connect } from './connection.ts';
import { blockedWarning, movedOnBlocked } from '../board/dependencies.ts';
import { mentions } from '../board/mentions.ts';
import { byStacking, isRecord, parseElement, supersedes, textOf } from '../board/model.ts';
import { parseTemplate } from '../board/savedTemplates.ts';
import { describeSession, isFaceDown, parseSession } from '../board/sessions.ts';
import { isAgentListens } from '../board/store.ts';

import type { Connection, Heard } from './connection.ts';
import type { BoardElement, Point } from '../board/model.ts';
import type { AgentStatus, Collaborator } from '../board/people.ts';
import type { SavedTemplate } from '../board/savedTemplates.ts';
import type { BoardSession } from '../board/sessions.ts';
import type { AgentListens, ChatMessage, OpenedBoard } from '../board/store.ts';

/**
 * An agent on one board: what it knows of the board, and how it acts on it — the way a page does.
 *
 * It reads the board through the action a page opens a locked board with (`board-open`, which answers an open board as
 * it is), keeps it current from the board's channel, commits through `board-apply`, and is on the room with a name, a
 * colour and a cursor: the people on the board see it arrive, point, write and speak. What it hears — lines of chat,
 * words at a cursor, changes made by the others — is kept for `wait_for_activity` to hand over.
 */

export type Activity =
  /** A line in the chat, or at a cursor — `toMe` when it names this agent with an @ (`mentions.ts`). */
  | { kind: 'chat'; name: string; text: string; at: number; toMe: boolean }
  | { kind: 'said'; name: string; text: string; at: number; toMe: boolean }
  | { kind: 'changed'; name: string; count: number; ids: string[]; at: number }
  | { kind: 'joined' | 'left'; name: string; at: number }
  /** What the board itself flags: a blocked card moved on. */
  | { kind: 'warning'; name: string; text: string; at: number }
  /** Somebody pressed stop on this agent: whatever it is doing, it stops. */
  | { kind: 'stop'; name: string; at: number };

type Member = { name: string; color: string; agent: boolean };

export type Session = Awaited<ReturnType<typeof joinBoard>>;

/** An element's id, as the canvas makes them. */
export const newElementId = (): string =>
  Array.from(
    { length: 12 },
    () => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[randomInt(62)]
  ).join('');

/**
 * A board link, a bare id, or an id with the server beside it — as a person pastes one to an agent. A link copied from
 * a locked board's invite panel carries the key its page opened it with (`#key=…`), which opens it for the agent too.
 */
export const parseLink = (link: string, fallbackOrigin: string): { origin: string; board: string; key?: string } => {
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

  const key = new URLSearchParams(url.hash.slice(1)).get('key');

  return { origin: url.origin, board: match[1], ...(key ? { key } : {}) };
};

/**
 * Where an agent reaches a board's server. `origin` is where it calls the actions and opens the channels; `publicOrigin`
 * is the board's address as the people on it know it — the same for an agent on a person's own machine, and not for one
 * the server hosts, which calls its own replica from inside. `headers` say who is asking: the server counts a caller's
 * changes by address, and a hosted agent's are its client's, not the loopback's every hosted agent shares.
 */
export type Door = { origin: string; publicOrigin: string; headers?: Record<string, string> };

/** A server reached as it is published: from outside, as anyone on its boards reaches it. */
export const doorTo = (origin: string): Door => ({ origin, publicOrigin: origin });

/** One call to a server action, as a page makes it: its answer, or what went wrong, in the server's words. */
export const callAction = async (door: Door, actionId: string, input: Record<string, unknown>): Promise<unknown> => {
  const response = await fetch(new URL('/_action', door.origin), {
    method: 'POST',
    headers: { ...door.headers, 'content-type': 'application/json' },
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
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.found === 'boolean' &&
  Array.isArray(value.elements) &&
  isRecord(value.grants);

/** How long an agent stays on a board with nobody else on it: long enough for a page that reloads to come back. */
const ALONE_MS = 2 * 60 * 1000;

/** How long its connection to the board may stay broken — a server restarting, a network gone — before it gives up. */
const LOST_MS = 2 * 60 * 1000;

/** How often it looks at whether it should still be here — and says where its cursor is, so it stays in sight. */
const WATCH_MS = 15_000;

export const joinBoard = async (
  { door, board, key }: { door: Door; board: string; key?: string },
  { name, color, password }: { name: string; color: string; password?: string }
) => {
  const { origin } = door;
  // `board-open` answers an open board as it is, and a locked one once its password — or the key a page that opened it
  // handed on in the link — is right: one door for all three.
  const loaded = await callAction(door, 'board-open', { id: board, password: password ?? '', key: key ?? '' });
  if (!isOpened(loaded) || !loaded.found) {
    throw new Error('There is no board there — it may have been deleted, or its time ran out');
  }

  if (loaded.locked && !loaded.topic) {
    throw new Error(
      'This board has a password. Ask for it, and join again with it — or for the link from its invite panel, which ' +
        'carries a key that opens it.'
    );
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
  /** The session with a script the board goes through — its writing step keeps the others' notes face down. */
  let session: BoardSession | undefined = parseSession(loaded.session);
  /** The board's library of templates, as it was read and as its channel says it changes. */
  const templatesOf = (value: unknown): SavedTemplate[] =>
    Array.isArray(value) ? value.map(parseTemplate).filter(template => template !== undefined) : [];
  let templates = templatesOf(loaded.templates);
  /** What this agent committed, as the server will announce it back: its own changes are not news to it. */
  const own = new Set<string>();
  const stampOf = (element: BoardElement): string => `${element.id}:${element.version}:${element.nonce}`;
  let gone = false;
  let cursor: Point = [0, 0];
  /** What the people see this agent doing (`AgentStatus`): it has just arrived, and is reading what is here. */
  let status: AgentStatus = 'thinking';
  /** When anything last happened on the board — the people's doing or this agent's: what its quiet is counted from. */
  let lastActive = Date.now();
  let quietMinutes = loaded.agentQuietMinutes;
  /** What wakes it while it listens, as the board's settings say (`AGENT_LISTENS`). */
  let listens = loaded.agentListens;
  /** Since when nobody but agents has been here. */
  let aloneSince: number | undefined;
  /** Why this agent left the board, once it has: said to its model, which may be asked to come back. */
  let left: string | undefined;
  /** When a temporary board goes for everyone — and this agent with it. */
  let expiresAt = loaded.expiresAt;
  /** Since when its socket on the board's channels could not be opened again. */
  let lostSince: number | undefined;
  /** Who pressed stop on it, until its next tool call hears it: that call is refused, and the work it was in with it. */
  let stopAsked: string | undefined;
  /** What this agent says at its cursor, and until when — carried by every move, so a dropped message loses nothing. */
  let saying = { text: '', until: 0 };
  /** The move that clears its words once their time is up. */
  let fade: ReturnType<typeof setTimeout> | undefined;
  /** Who this agent is on the board, as a page's visitor id: what it writes face down is its own by this, not its name. */
  const visitor = Array.from({ length: 16 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[randomInt(36)]).join('');

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
        const changed: string[] = [];
        const before = new Map<string, BoardElement>();
        for (const element of data.map(parseElement)) {
          if (element && supersedes(element, elements.get(element.id))) {
            const was = elements.get(element.id);
            if (was) {
              before.set(element.id, was);
            }

            elements.set(element.id, element);
            if (!own.delete(stampOf(element))) {
              changed.push(element.id);
            }
          } else if (element) {
            own.delete(stampOf(element));
          }
        }

        if (changed.length) {
          lastActive = Date.now();
          note({ kind: 'changed', name: 'the board', count: changed.length, ids: changed, at: Date.now() });
          // A card someone moved on while what it waits on is still open: what a guardian is there to catch.
          const movedOn = movedOnBlocked(
            changed.flatMap(id => elements.get(id) ?? []),
            id => before.get(id),
            id => elements.get(id)
          );
          for (const entry of movedOn) {
            note({ kind: 'warning', name: 'The board', text: blockedWarning(entry), at: Date.now() });
          }
        }
      } else if (type === 'chat' && isRecord(data) && typeof data.text === 'string') {
        const line: ChatMessage = {
          id: textOf(data.id),
          name: textOf(data.name, 'Someone'),
          color: textOf(data.color),
          text: data.text,
          at: Number(data.at ?? Date.now()),
          by: textOf(data.by),
          ...(data.agent === true ? { agent: true } : {})
        };
        chat.push(line);
        lastActive = Date.now();
        // Said at a cursor and then kept in the chat — the cursor chat does both — it is heard once, as a chat line.
        const last = activity.at(-1);
        if (last?.kind === 'said' && last.name === line.name && last.text.trim() === line.text.trim()) {
          activity.pop();
        }

        if (!line.agent || line.name !== name) {
          note({ kind: 'chat', name: line.name, text: line.text, at: line.at, toMe: mentions(line.text, name) });
        }
      } else if (type === 'title' && isRecord(data) && typeof data.title === 'string') {
        title = data.title;
      } else if (type === 'session' && isRecord(data)) {
        session = parseSession(data.session);
        // The board itself speaks to everyone on it — its agents too.
        note({
          kind: 'chat',
          name: 'The board',
          text: session ? `Session: ${describeSession(session)}` : 'The session is over.',
          at: Date.now(),
          toMe: true
        });
      } else if (type === 'templates' && isRecord(data)) {
        templates = templatesOf(data.templates);
      } else if (type === 'reach' && isRecord(data)) {
        expiresAt = typeof data.expiresAt === 'number' ? data.expiresAt : null;
      } else if (type === 'agents' && isRecord(data)) {
        if (typeof data.agentQuietMinutes === 'number') {
          quietMinutes = data.agentQuietMinutes;
        }

        if (isAgentListens(data.agentListens)) {
          listens = data.agentListens;
        }
      } else if (type === 'locked') {
        // A password set, changed or removed: the key this agent opened it with — and the topic it listens on — are
        // the old one's. It goes, and says why; whoever wants it back sends the board again.
        leave('the board’s password changed');
      } else if (type === 'deleted') {
        gone = true;
        note({ kind: 'left', name: 'The board was deleted', at: Date.now() });
        leave('the board was deleted');
      }

      return;
    }

    // The room: who is here, and what they say at their cursors. A person moving on the board is the board alive.
    if (!members.get(from)?.agent && type === 'pointer') {
      lastActive = Date.now();
    }

    if (type === 'dismiss' && isRecord(data) && data.to === connection.me) {
      // Gone already and still seen — its socket outlived its going: a second ✕ takes it off for good.
      if (left !== undefined) {
        connection.close();

        return;
      }

      leave(`${nameOf(from)} asked me to leave`);

      return;
    }

    if (type === 'interrupt' && isRecord(data) && data.to === connection.me) {
      stopAsked = nameOf(from);
      note({ kind: 'stop', name: stopAsked, at: Date.now() });

      return;
    }

    if (type === '$presence' && isRecord(data) && typeof data.name === 'string') {
      const known = members.has(from);
      members.set(from, { name: data.name, color: textOf(data.color), agent: data.agent === true });
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
        last.toMe = mentions(data.chat, name);
      } else {
        note({ kind: 'said', name: nameOf(from), text: data.chat, at: Date.now(), toMe: mentions(data.chat, name) });
      }
    }
  };

  const topics = [`board:${loaded.topic}`, `room:${loaded.topic}`];
  // What `board-open` let this agent in with: the channels are private, as they are to a page.
  const grants = [loaded.grants.board, loaded.grants.room];
  const room = `room:${loaded.topic}`;
  const self = (): Collaborator => ({ name, color, agent: true, status });
  let connection: Connection = await connect(origin, topics, grants, heard => hear(heard));
  connection.announce(room, self());

  /** A dropped socket is reopened before anything is said on it. */
  const live = async (): Promise<Connection> => {
    // Once it has left, nothing opens its line again — a cursor move still pending would bring it back as a ghost.
    if (left !== undefined) {
      throw new Error(`I left the board — ${left}`);
    }

    if (connection.closed) {
      connection = await connect(origin, topics, grants, heard => hear(heard));
      connection.announce(room, self());
    }

    return connection;
  };

  const people = (): number => [...members.values()].filter(member => !member.agent).length;

  /**
   * Off the board, for `reason` — said in the chat when there is anyone to read it, so nobody wonders where it went. An
   * agent leaves when it is asked to, when nobody is here, after the quiet the board asks for, and when the board it
   * opened is not the one there any more (deleted, or its password changed).
   */
  const leave = (reason: string, announce = true): void => {
    if (left !== undefined) {
      return;
    }

    left = reason;
    clearInterval(watch);
    clearTimeout(fade);
    const goodbye =
      announce && people() > 0 && !gone
        ? callAction(door, 'board-chat', {
            board,
            key: loaded.key,
            name,
            color,
            text: `✦ I have left the board — ${reason}. Ask me to join again when you need me.`,
            by: '',
            agent: 'true'
          }).catch(() => undefined)
        : Promise.resolve();
    void goodbye.then(() => connection.close());
    waiters.forEach(wake => wake());
  };

  // Whether it should still be here — and its cursor said again, so it stays where the people last saw it working.
  const watch = setInterval(() => {
    const now = Date.now();
    aloneSince = people() > 0 ? undefined : (aloneSince ?? now);
    if (expiresAt !== null && now >= expiresAt) {
      gone = true;
      leave('the board’s time ran out');
    } else if (lostSince !== undefined && now - lostSince > LOST_MS) {
      leave('I lost my connection to the board');
    } else if (aloneSince !== undefined && now - aloneSince > ALONE_MS) {
      leave('nobody else was on the board');
    } else if (now - lastActive > quietMinutes * 60_000) {
      leave(`nothing happened on the board for ${quietMinutes} minutes`);
    } else {
      // Its cursor said again — and a dropped socket opened again by saying it: what fails is counted as lost.
      pointer(cursor).then(
        () => {
          lostSince = undefined;
        },
        () => {
          lostSince ??= now;
        }
      );
    }
  }, WATCH_MS);
  watch.unref();

  const shown = (): BoardElement[] => [...elements.values()].filter(element => !element.deleted).sort(byStacking);

  /** Where the others see this agent look: a box around what it is working on. */
  const viewAround = ([x, y]: Point): [number, number, number, number] => [
    Math.round(x - 700),
    Math.round(y - 420),
    1400,
    840
  ];

  const pointer = async (at: Point, extra: Record<string, unknown> = {}): Promise<void> => {
    cursor = at;
    if (left !== undefined) {
      return;
    }

    await (
      await live()
    ).publish(`room:${loaded.topic}`, 'pointer', {
      x: Math.round(at[0]),
      y: Math.round(at[1]),
      sentAt: Date.now(),
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
    await callAction(door, 'board-apply', { board, key: loaded.key, ops: stamped });
    stamped.forEach(element => elements.set(element.id, element));

    return stamped;
  };

  return {
    board,
    link: new URL(`/b/${board}`, door.publicOrigin).href,
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
    /** The templates in the board's library, newest first. */
    templates: (): SavedTemplate[] => templates,
    /** What `elements` are, kept as a template named `title` in the board's library: answers its code and name. */
    saveTemplate: async (title: string, elements: BoardElement[]): Promise<{ id: string; title: string }> => {
      const answer = await callAction(door, 'board-template-save', { board, key: loaded.key, title, elements });
      const saved = isRecord(answer) && isRecord(answer.template) ? answer.template : undefined;
      if (!isRecord(answer) || !saved) {
        throw new Error('board-template-save: no template came back');
      }

      templates = templatesOf(answer.templates);

      return { id: textOf(saved.id), title: textOf(saved.title) };
    },
    /** A template another board keeps, added to this board's library by its code — and answered whole. */
    addTemplate: async (code: string): Promise<SavedTemplate> => {
      const answer = await callAction(door, 'board-template-add', { board, key: loaded.key, code });
      const added = isRecord(answer) ? parseTemplate(answer.template) : undefined;
      if (!isRecord(answer) || !added) {
        throw new Error(`board-template-add: no template came back for ${code}`);
      }

      templates = templatesOf(answer.templates);

      return added;
    },
    /** The session under way, if one is. */
    session: (): BoardSession | undefined => session,
    /** Whether what someone else wrote is still face down for this agent: its words are not out yet. */
    faceDown: (element: BoardElement): boolean => isFaceDown(element, session, visitor),
    visitor,
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
      clearTimeout(fade);
      fade = setTimeout(() => void pointer(cursor).catch(() => undefined), 5100);
    },
    /**
     * A presentation, as a page gives one: every page on the board eases to `view` and says who presents and where —
     * `index` from 0 of `total`; an `index` of -1 ends it.
     */
    present: async (
      view: [number, number, number, number],
      index: number,
      total: number,
      title: string
    ): Promise<void> => {
      await (await live()).publish(`room:${loaded.topic}`, 'present', { view, index, total, title });
    },
    /** The board's session with a script: started with `script`, moved to its next step, or stopped. */
    runSession: async (command: 'start' | 'next' | 'stop', script?: string): Promise<void> => {
      await callAction(door, 'board-session', {
        board,
        key: loaded.key,
        command,
        ...(script ? { script } : {}),
        host: name
      });
    },
    /** A line in the board's chat, kept with the board, marked as an agent's. */
    chatLine: async (text: string): Promise<void> => {
      await callAction(door, 'board-chat', { board, key: loaded.key, name, color, text, by: '', agent: 'true' });
    },
    react: async (emoji: string): Promise<void> => {
      await (await live()).publish(`room:${loaded.topic}`, 'reaction', { emoji, x: cursor[0], y: cursor[1] });
    },
    reply: async (element: string, text: string): Promise<void> => {
      await callAction(door, 'board-reply', { board, key: loaded.key, element, author: name, text });
    },
    /**
     * What happened since `since` — only what `worth` keeps, when it is given: as soon as there is anything, or when
     * `ms` have passed with nothing.
     */
    activitySince: async (
      since: number,
      ms: number,
      worth: (entry: Activity) => boolean = () => true
    ): Promise<Activity[]> => {
      const fresh = (): Activity[] => activity.filter(entry => entry.at > since && worth(entry));
      if (!fresh().length && ms > 0) {
        await new Promise<void>(resolve => {
          const finish = (): void => {
            clearTimeout(timeout);
            waiters.delete(heard);
            // A moment for whoever is typing at their cursor to finish the line.
            setTimeout(resolve, 1200);
          };
          // Woken by something not worth handing over, waiting goes on for the rest of the time — unless it was this
          // agent leaving the board, which ends it.
          const heard = (): void => {
            if (fresh().length || left !== undefined) {
              finish();
            }
          };
          const timeout = setTimeout(finish, ms);
          waiters.add(heard);
        });
      }

      return fresh();
    },
    /** Why it left the board, once it has — by a rule, or asked to. */
    get left() {
      return left;
    },
    /** Who pressed stop on it since it last looked — and the press forgotten, since it has now been heard. */
    takeStop: (): string | undefined => {
      const who = stopAsked;
      stopAsked = undefined;

      return who;
    },
    /**
     * What was said to it on the board since `since` — lines that name it, warnings, stops: what it answers while
     * working. What the people say to each other is not in it.
     */
    saidSince: (since: number): Activity[] =>
      activity.filter(
        entry =>
          entry.at > since &&
          (((entry.kind === 'chat' || entry.kind === 'said') && entry.toMe) ||
            entry.kind === 'warning' ||
            entry.kind === 'stop')
      ),
    /** Everything heard since `since`, what it waits on or not: what it reads the board by. */
    heardSince: (since: number): Activity[] => activity.filter(entry => entry.at > since),
    get status() {
      return status;
    },
    /** What wakes it while it listens: only what names it, or every change too. */
    get listens(): AgentListens {
      return listens;
    },
    /** What the people see it doing: said on the room, and its cursor said again with it, so it shows where it is. */
    setStatus: (next: AgentStatus): void => {
      if (next === status || left !== undefined) {
        return;
      }

      status = next;
      connection.announce(room, self());
      void pointer(cursor).catch(() => undefined);
    },
    /** It did something: the board is not quiet. */
    touch: (): void => {
      lastActive = Date.now();
    },
    /** Off the board: said in the chat when there is a `reason` to give — without one, it has said goodbye itself. */
    leave: (reason?: string): void => leave(reason ?? 'I said goodbye', reason !== undefined)
  };
};
