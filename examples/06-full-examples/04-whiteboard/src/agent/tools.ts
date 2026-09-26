import { z } from 'zod';

import { describeBoard, describeElement } from './describe.ts';
import { cardHeight, frameNamed, placeAll } from './place.ts';
import { callAction, joinBoard, newElementId, parseLink } from './session.ts';
import { DUTY_PRESETS, instructionOf } from '../board/duties.ts';
import { markedDone, settleDone } from '../board/model.ts';
import { isEmptyQuery, matchesQuery, parseQuery } from '../board/query.ts';
import { isStamp, REACTIONS, STAMPS } from '../board/reactions.ts';
import { SCRIPT_IDS, SCRIPTS } from '../board/sessions.ts';
import { TEMPLATES } from '../board/templates.ts';
import { branchFrame, frameContents, mergeBranch } from '../plugins/Board/branches.ts';
import { releasedFrom } from '../plugins/Board/connectors.ts';
import { COLUMN_PADDING, layoutColumn, membersOf, moved, readingOrder } from '../plugins/Board/containers.ts';
import { anchorPoint, boundsOf, nearestAnchor } from '../plugins/Board/geometry.ts';
import { restyled } from '../plugins/Board/styling.ts';

import type { Activity, Session } from './session.ts';
import type { BoardElement, Point } from '../board/model.ts';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * What an agent can do on a board, as MCP tools — the same things a person does, through the same doors: joining is
 * reading the board and announcing itself on its room; everything it adds is a commit; everything it says is the
 * board's chat or words at its cursor. The people on the board watch it happen.
 */

export type AgentOptions = {
  /** Where a bare board id is looked for, and new boards are made. */
  server: string;
  name: string;
  color: string;
};

const ELEMENT_TYPES = [
  'sticky',
  'card',
  'text',
  'frame',
  'comment',
  'rectangle',
  'ellipse',
  'diamond',
  'triangle',
  'hexagon',
  'cylinder',
  'star',
  'stamp'
] as const;

const COLOURS =
  'yellow, red, orange, green, blue, violet (notes, cards, frames, fills); ink for text and outlines — named ones follow ' +
  'the light and dark schemes; any other as #rrggbb, drawn as it is in both';

/** A card is a task on a kanban: it lives in a column, as the canvas's card tool makes it. */
const CARD_IN_COLUMN =
  'a card is a task on a kanban and goes in a column: give `frame` the id or title of a column (a frame with ' +
  'layout "column" — add one first if the board has none), or use a sticky note for a loose one.';

/** Someone locked it so it stays as it is: changed only by whoever unlocks it first — as on the canvas. */
const lockedProblem = (element: BoardElement): string =>
  `${element.id} is locked, so it stays as it is. Leave it, or unlock it first: update_elements with ` +
  `{ id: "${element.id}", locked: false } — and only if the people here asked for it to change.`;

const text = (value: string) => ({ content: [{ type: 'text' as const, text: value }] });

const centre = (element: BoardElement): Point => {
  const box = boundsOf(element);

  return [box.x + box.width / 2, box.y + box.height / 2];
};

const describeActivity = (entry: Activity): string => {
  switch (entry.kind) {
    case 'chat':
      return `${entry.name} in the chat: ${entry.text}`;
    case 'said':
      return `${entry.name} at their cursor: ${entry.text}`;
    case 'changed':
      return `${entry.count} element(s) changed on the board`;
    case 'joined':
      return `${entry.name} joined`;
    case 'left':
      return `${entry.name} left`;
  }
};

export const registerTools = (server: McpServer, options: AgentOptions): void => {
  let session: Session | undefined;
  let lastLooked = Date.now();

  const onBoard = (): Session => {
    if (!session) {
      throw new Error('Join a board first: join_board with its link');
    }

    if (session.gone) {
      throw new Error('That board was deleted — join another');
    }

    return session;
  };

  const join = async (link: string, password?: string): Promise<Session> => {
    session?.leave();
    session = undefined;
    const next = await joinBoard(parseLink(link, options.server), {
      name: options.name,
      color: options.color,
      ...(password ? { password } : {})
    });
    session = next;
    lastLooked = Date.now();
    // In the middle of what is there, where people will see it arrive.
    const elements = next.elements();
    const landing = elements.length ? centre(elements[Math.floor(elements.length / 2)]) : ([0, 0] as Point);
    await next.glide(landing);

    return next;
  };

  server.registerTool(
    'join_board',
    {
      title: 'Join a board',
      description:
        'Join a Pizarra board as a collaborator: you appear on it by name with your own cursor, and can read, draw and ' +
        'talk. Give the link someone shared (https://…/b/abcd234xyz) — or just its id. A locked board needs its ' +
        'password. Answers everything on the board, the people on it and the recent chat.',
      inputSchema: {
        link: z.string().describe('The board link, or its 10-character id'),
        password: z.string().optional().describe('Only for a locked board')
      }
    },
    async ({ link, password }) => text(describeBoard(await join(link, password)))
  );

  server.registerTool(
    'create_board',
    {
      title: 'Start a board',
      description:
        'Start a new board — blank or from a template — and join it. Answers its link, to share with the people who ' +
        'should draw on it.',
      inputSchema: {
        title: z.string().describe('What the board is called'),
        template: z.enum(TEMPLATES).optional(),
        visibility: z.enum(['public', 'private']).optional().describe('Private: only people with the link find it'),
        hours: z.enum(['1', '5', '24']).optional().describe('A temporary board, gone for everyone after this long')
      }
    },
    async ({ title, template, visibility, hours }) => {
      const created = await callAction(options.server, 'board-create', {
        title,
        template: template ?? 'blank',
        visibility: visibility ?? 'public',
        hours: hours ?? ''
      });
      const id = typeof created === 'object' && created !== null && 'id' in created ? String(created.id) : '';
      const joined = await join(id);

      return text(`Started "${joined.title}": ${joined.link}\n\n${describeBoard(joined)}`);
    }
  );

  server.registerTool(
    'read_board',
    {
      title: 'Read the board',
      description:
        'Everything on the board now — each element with its id, type, text, position and frame; the connections; ' +
        'who is here; the last lines of chat. Read it before changing things others may have moved.',
      inputSchema: {}
    },
    () => text(describeBoard(onBoard()))
  );

  server.registerTool(
    'find_elements',
    {
      title: 'Find on the board',
      description:
        'Only what matches — cheaper than read_board on a big board. The query is what a person types in the ' +
        "board's search: words (in its text, description or author), #tag (a hashtag written in it — tag things by " +
        'writing #word in their text), @name (who wrote it), in:column (the frame it is in, by title — quote two ' +
        'words: in:"to do"), is:open / is:done (cards, comments), is:locked, type:card / note / frame…, color:red. ' +
        'Every part must match.',
      inputSchema: {
        query: z.string().min(1).max(400).describe('e.g. `#bug is:open in:doing` or `launch @ana`'),
        limit: z.number().int().positive().max(500).optional().describe('At most this many (100)')
      }
    },
    ({ query, limit }) => {
      const board = onBoard();
      const elements = board.elements();
      const frames = new Map(elements.filter(element => element.type === 'frame').map(frame => [frame.id, frame]));
      const parsed = parseQuery(query);
      const found = isEmptyQuery(parsed)
        ? []
        : elements.filter(
            element => !board.faceDown(element) && matchesQuery(element, parsed, id => frames.get(id)?.text?.trim())
          );
      const shown = found.slice(0, limit ?? 100);

      return text(
        found.length
          ? `${found.length} found${shown.length < found.length ? `, the first ${shown.length}` : ''}:\n` +
              shown.map(element => describeElement(element, frames, board.faceDown)).join('\n')
          : `Nothing matches "${query}".`
      );
    }
  );

  server.registerTool(
    'add_elements',
    {
      title: 'Add to the board',
      description:
        'Put things on the board, all at once: sticky notes, cards (tasks, with a done box and a description — a card ' +
        'goes in a column), text, frames (sections — a frame with layout "column" is a kanban lane that stacks what ' +
        'is put in it), comments, and shapes with a ' +
        `label, and stamps (an emoji put on the board: its text is one of ${STAMPS.join(' ')}). Give \`frame\` ` +
        '(its id or title) to put something in a frame; give x/y only to place it exactly — ' +
        `left out, it is placed in free space for you. Colours: ${COLOURS}. Answers each new element's id.`,
      inputSchema: {
        elements: z
          .array(
            z.object({
              type: z.enum(ELEMENT_TYPES),
              text: z
                .string()
                .max(4000)
                .optional()
                .describe('What it says — a card’s or a frame’s title, a shape’s label'),
              description: z
                .string()
                .max(4000)
                .optional()
                .describe('Cards: what the task is about, beyond its title — shown when the card is opened'),
              frame: z.string().optional().describe('Id or title of the frame to put it in — a column, for a card'),
              x: z.number().optional(),
              y: z.number().optional(),
              width: z.number().positive().optional(),
              height: z.number().positive().optional(),
              color: z.string().optional(),
              layout: z.enum(['column']).optional().describe('Frames only: stack what is put in it'),
              completes: z
                .boolean()
                .optional()
                .describe('Columns only: the team’s Done — a card put or moved into it is ticked off'),
              done: z.boolean().optional().describe('Cards: already done')
            })
          )
          .min(1)
          .max(100)
      }
    },
    async ({ elements }) => {
      const board = onBoard();
      const unstamped = elements.findIndex(element => element.type === 'stamp' && !isStamp(element.text));
      if (unstamped !== -1) {
        throw new Error(`Element ${unstamped + 1} is a stamp: its text must be one of ${STAMPS.join(' ')}`);
      }

      const loose = elements.findIndex(
        element => element.type === 'card' && frameNamed(board, element.frame)?.layout !== 'column'
      );
      if (loose !== -1) {
        throw new Error(`Element ${loose + 1} is a card: ${CARD_IN_COLUMN}`);
      }

      const described = elements.findIndex(element => element.description !== undefined && element.type !== 'card');
      if (described !== -1) {
        throw new Error(`Element ${described + 1} is a ${elements[described].type}: only a card has a description.`);
      }

      const placed = placeAll(board, elements);
      const first = placed[0];
      await board.glide(centre(first));
      const kept = await board.commit(placed);
      // New ones are at their first version; the rest are what making room for them moved.
      const added = kept.filter(element => element.version === 1);
      const frames = new Map(
        board
          .elements()
          .filter(element => element.type === 'frame')
          .map(frame => [frame.id, frame])
      );

      return text(
        `Added ${added.length}:\n${added.map(element => describeElement(element, frames, board.faceDown)).join('\n')}`
      );
    }
  );

  server.registerTool(
    'connect',
    {
      title: 'Connect things',
      description:
        'Draw arrows (or lines) between elements, fixed to them: they follow when either is moved. Each connection ' +
        'leaves from the side facing the other end.',
      inputSchema: {
        connections: z
          .array(
            z.object({
              from: z.string().describe('Element id'),
              to: z.string().describe('Element id'),
              kind: z.enum(['arrow', 'line']).optional(),
              dashed: z.boolean().optional()
            })
          )
          .min(1)
          .max(100)
      }
    },
    async ({ connections }) => {
      const board = onBoard();
      let z = board.topZ();
      const made = connections.map(({ from, to, kind, dashed }) => {
        const [start, end] = [board.element(from), board.element(to)];
        if (!start || !end) {
          throw new Error(`No element ${start ? to : from} on the board — read_board for the ids`);
        }

        const [startAnchor, endAnchor] = [nearestAnchor(start, centre(end)), nearestAnchor(end, centre(start))];
        const [a, b] = [anchorPoint(start, startAnchor), anchorPoint(end, endAnchor)];
        z += 1;

        return {
          id: newElementId(),
          type: kind ?? 'arrow',
          x: a[0],
          y: a[1],
          width: Math.abs(b[0] - a[0]),
          height: Math.abs(b[1] - a[1]),
          points: [
            [0, 0],
            [b[0] - a[0], b[1] - a[1]]
          ],
          start: { id: start.id, anchor: startAnchor },
          end: { id: end.id, anchor: endAnchor },
          stroke: 'ink',
          fill: 'none',
          strokeWidth: 2,
          seed: Math.floor(Math.random() * 2 ** 31),
          z,
          version: 0,
          nonce: 0,
          deleted: false,
          ...(dashed ? { dash: 'dashed' } : {})
        } satisfies BoardElement;
      });
      await board.glide(centre(made[0]));
      const kept = await board.commit(made);

      return text(`Connected: ${kept.map(element => element.id).join(', ')}`);
    }
  );

  server.registerTool(
    'update_elements',
    {
      title: 'Change things',
      description:
        'Change elements by id: their text, place, size, colour; a card’s description; tick a card done or resolve a ' +
        'comment; move something into a frame (by id or title — a column places it, and a card moved into a column ' +
        'that completes is ticked off, out of one open again); make a frame a column, or a column the team’s Done ' +
        '(`completes`); lock or unlock it. ' +
        'A locked element (read_board marks it) is not changed unless the same change unlocks it.',
      inputSchema: {
        changes: z
          .array(
            z.object({
              id: z.string(),
              text: z.string().max(4000).optional(),
              description: z.string().max(4000).optional().describe('Cards only: "" removes it'),
              x: z.number().optional(),
              y: z.number().optional(),
              width: z.number().positive().optional(),
              height: z.number().positive().optional(),
              color: z.string().optional(),
              done: z.boolean().optional(),
              frame: z.string().optional().describe('Id or title of the frame to move it into; "" takes it out'),
              layout: z.enum(['column', 'free']).optional().describe('Frames only'),
              completes: z
                .boolean()
                .optional()
                .describe('Columns only: a card moved into it is ticked off, and moved out of it open again'),
              locked: z.boolean().optional().describe('Locked: nobody moves, resizes, restyles or removes it')
            })
          )
          .min(1)
          .max(100)
      }
    },
    async ({ changes }) => {
      const board = onBoard();
      const next = new Map<string, BoardElement>();
      for (const change of changes) {
        const current = board.element(change.id);
        if (!current) {
          throw new Error(`No element ${change.id} on the board — read_board for the ids`);
        }

        if (current.locked && change.locked !== false) {
          throw new Error(lockedProblem(current));
        }

        if (change.description !== undefined && current.type !== 'card') {
          throw new Error(`${current.id} is a ${current.type}: only a card has a description.`);
        }

        const frame = change.frame === undefined ? undefined : frameNamed(board, change.frame);
        if (current.type === 'card' && change.frame !== undefined && frame?.layout !== 'column') {
          throw new Error(`${current.id} is a card: ${CARD_IN_COLUMN}`);
        }

        if (change.completes !== undefined && current.type !== 'frame') {
          throw new Error(`${current.id} is a ${current.type}: only a column completes what lands in it.`);
        }

        const {
          done: _done,
          parent: _parent,
          layout: _layout,
          completes: _completes,
          locked: _locked,
          description: _description,
          ...rest
        } = current;
        let element: BoardElement = {
          ...rest,
          ...(change.text === undefined ? {} : { text: change.text }),
          ...(change.x === undefined ? {} : { x: change.x }),
          ...(change.y === undefined ? {} : { y: change.y }),
          ...(change.width === undefined ? {} : { width: change.width }),
          ...(change.height === undefined ? {} : { height: change.height })
        };
        const done = change.done ?? current.done;
        const layout = change.layout === undefined ? current.layout : change.layout === 'column' ? 'column' : undefined;
        // Only a column decides what is done: one that stops being a column stops.
        const completes = layout === 'column' && (change.completes ?? current.completes) === true;
        const description = change.description ?? current.description;
        const parent = change.frame === undefined ? current.parent : frame?.id;
        const locked = change.locked ?? current.locked;
        element = {
          ...element,
          ...(done ? { done: true } : {}),
          ...(description?.trim() ? { description } : {}),
          ...(locked ? { locked: true } : {}),
          ...(layout ? { layout } : {}),
          ...(completes ? { completes } : {}),
          ...(parent ? { parent } : {})
        };
        // A colour is what the element is coloured by: a note's paper, a shape's fill, a text's ink.
        if (change.color) {
          element = restyled(element, element.type === 'text' ? { stroke: change.color } : { fill: change.color });
        }

        if (element.type === 'card') {
          element = { ...element, height: cardHeight(element) };
        }

        next.set(element.id, element);
      }

      const all = new Map(board.elements().map(element => [element.id, element]));
      next.forEach((element, id) => all.set(id, element));
      // A card moved into a column that completes is done, out of one open again, as on a canvas — unless the same
      // change said otherwise. A column made the Done makes done what it already holds.
      const ticked = new Set(changes.flatMap(change => (change.done === undefined ? [] : [change.id])));
      const moves = settleDone(
        [...next.values()].filter(element => !ticked.has(element.id)),
        id => (id === undefined ? undefined : all.get(id)),
        id => board.element(id)?.parent
      );
      const madeDone = [...next.values()].flatMap(element =>
        element.completes && !board.element(element.id)?.completes
          ? membersOf([...all.values()], element.id).filter(
              member => member.type === 'card' && !member.done && !member.locked && !ticked.has(member.id)
            )
          : []
      );
      for (const settled of [...moves, ...madeDone.map(card => markedDone(all.get(card.id) ?? card, true))]) {
        next.set(settled.id, settled);
        all.set(settled.id, settled);
      }

      // Columns something entered, left or changed in are laid out again, as a canvas would.
      const columns = new Set(
        [...next.values()].flatMap(element => [element.parent, board.element(element.id)?.parent].filter(Boolean))
      );
      for (const id of columns) {
        const column = id ? all.get(id) : undefined;
        if (column?.layout === 'column') {
          const width = column.width - COLUMN_PADDING * 2;
          for (const laid of layoutColumn(column, membersOf([...all.values()], column.id), element =>
            element.type === 'card' ? { ...element, width, height: cardHeight({ ...element, width }) } : element
          )) {
            if (moved(all.get(laid.id), laid)) {
              next.set(laid.id, laid);
              all.set(laid.id, laid);
            }
          }
        }
      }

      const changed = [...next.values()];
      await board.glide(centre(changed[0]));
      await board.commit(changed);

      return text(`Changed ${changed.length} element(s).`);
    }
  );

  server.registerTool(
    'delete_elements',
    {
      title: 'Remove things',
      description:
        'Remove elements by id. Arrows fixed to them stay, let go where they are. A locked element is not removed: ' +
        'unlock it first, and only if the people here asked for it.',
      inputSchema: { ids: z.array(z.string()).min(1).max(200) }
    },
    async ({ ids }) => {
      const board = onBoard();
      const removed = ids
        .map(id => board.element(id))
        .filter((element): element is BoardElement => element !== undefined);
      if (!removed.length) {
        throw new Error('None of those ids is on the board — read_board for the ids');
      }

      const locked = removed.find(element => element.locked);
      if (locked) {
        throw new Error(lockedProblem(locked));
      }

      await board.glide(centre(removed[0]));
      await board.commit([
        ...removed.map(element => ({ ...element, deleted: true })),
        ...releasedFrom(board.elements(), new Set(removed.map(element => element.id)))
      ]);

      return text(`Removed ${removed.length} element(s).`);
    }
  );

  server.registerTool(
    'say',
    {
      title: 'Talk to the people on the board',
      description:
        'Say something: in the board’s chat (kept with the board, marked as an agent’s), and for a few seconds at ' +
        'your cursor. Use it to explain what you are doing, to ask, and to answer.',
      inputSchema: {
        text: z.string().min(1).max(500),
        where: z.enum(['chat', 'cursor', 'both']).optional().describe('Default: both')
      }
    },
    async ({ text: said, where = 'both' }) => {
      const board = onBoard();
      if (where !== 'cursor') {
        await board.chatLine(said);
      }

      if (where !== 'chat') {
        await board.sayAtCursor(said);
      }

      return text('Said.');
    }
  );

  server.registerTool(
    'point_at',
    {
      title: 'Point at something',
      description:
        'Move your cursor to an element or a place on the board, so people see what you mean — with the laser, it ' +
        'leaves a trail everyone sees.',
      inputSchema: {
        id: z.string().optional(),
        x: z.number().optional(),
        y: z.number().optional(),
        laser: z.boolean().optional()
      }
    },
    async ({ id, x, y, laser }) => {
      const board = onBoard();
      const target = id ? board.element(id) : undefined;
      const at: Point | undefined = target ? centre(target) : x !== undefined && y !== undefined ? [x, y] : undefined;
      if (!at) {
        throw new Error('Point at an element (id) or a place (x and y)');
      }

      await board.glide(at, laser ? { laser: true } : {});
      if (laser) {
        // A circle around it: what a laser is for.
        for (let step = 0; step <= 24; step += 1) {
          const angle = (step / 24) * Math.PI * 2;
          await board.pointer([at[0] + Math.cos(angle) * 60, at[1] + Math.sin(angle) * 40], { laser: true });
          await new Promise(resolve => setTimeout(resolve, 30));
        }
      }

      return text(`Pointing at (${Math.round(at[0])}, ${Math.round(at[1])}).`);
    }
  );

  server.registerTool(
    'react',
    {
      title: 'React',
      description: `Float an emoji up from your cursor, for everyone: one of ${REACTIONS.join(' ')}`,
      inputSchema: { emoji: z.enum(REACTIONS) }
    },
    async ({ emoji }) => {
      await onBoard().react(emoji);

      return text('Reacted.');
    }
  );

  server.registerTool(
    'reply_to_comment',
    {
      title: 'Answer a comment',
      description:
        'Answer in a comment’s thread (comments are pinned feedback; read_board shows them and their replies).',
      inputSchema: { id: z.string(), text: z.string().min(1).max(1000) }
    },
    async ({ id, text: said }) => {
      const board = onBoard();
      const comment = board.element(id);
      if (comment?.type !== 'comment') {
        throw new Error(`No comment ${id} on the board`);
      }

      await board.glide(centre(comment));
      await board.reply(id, said);

      return text('Answered.');
    }
  );

  server.registerTool(
    'wait_for_activity',
    {
      title: 'Listen',
      description:
        'Wait for the people on the board — a line in the chat, words at a cursor, changes, someone arriving — and ' +
        'answer what happened since you last looked. Use it to hold a conversation: say something, then listen.',
      inputSchema: {
        seconds: z.number().min(0).max(120).optional().describe('How long to wait at most; default 30'),
        frames: z
          .array(z.string())
          .max(20)
          .optional()
          .describe(
            'Only changes inside these frames (ids or titles) — the ones you have a duty in — and what people say. ' +
              'Each change is described, so you can act on it.'
          )
      }
    },
    async ({ seconds = 30, frames }) => {
      const board = onBoard();
      const watched = new Set((frames ?? []).flatMap(name => frameNamed(board, name)?.id ?? []));
      if (frames?.length && !watched.size) {
        throw new Error(`No frame named ${frames.join(', ')} on the board — my_duties or read_board for the ids`);
      }

      const inWatched = (id: string): boolean => {
        const element = board.element(id);

        return (
          element !== undefined &&
          (watched.has(element.id) || (element.parent !== undefined && watched.has(element.parent)))
        );
      };
      const worth = (entry: Activity): boolean =>
        !watched.size || entry.kind !== 'changed' || entry.ids.some(inWatched);
      const since = lastLooked;
      const heard = await board.activitySince(since, seconds * 1000, worth);
      lastLooked = Date.now();
      if (!heard.length) {
        return text(`Nothing happened in ${seconds} seconds.`);
      }

      const frameMap = new Map(
        board
          .elements()
          .filter(element => element.type === 'frame')
          .map(frame => [frame.id, frame])
      );
      // In the frames watched, what changed is told element by element: that is what a duty acts on.
      const lines = heard.flatMap(entry => {
        if (!watched.size || entry.kind !== 'changed') {
          return [describeActivity(entry)];
        }

        const changed = [...new Set(entry.ids)].filter(inWatched).flatMap(id => board.element(id) ?? []);

        return [
          `${changed.length} changed in your frames:`,
          ...changed.map(element => describeElement(element, frameMap, board.faceDown))
        ];
      });

      return text(lines.join('\n'));
    }
  );

  /** Where the presentation this agent gives is — `undefined` while it gives none. */
  let presenting: number | undefined;

  server.registerTool(
    'present_frame',
    {
      title: 'Present a frame',
      description:
        'Take everyone on the board to a frame, as a person presenting does — their screens ease there and say you ' +
        'are presenting, which frame of how many. Left out, the next frame in reading order (the first, to begin). ' +
        'Answers what is in the frame, so you can talk about it: give `say` to say it at your cursor and in the chat ' +
        'at once. Walk the room through a board a frame at a time; end_presentation when done.',
      inputSchema: {
        frame: z.string().optional().describe('The frame, by id or title'),
        say: z.string().max(400).optional().describe('What to say about it, as you show it')
      }
    },
    async ({ frame: name, say }) => {
      const board = onBoard();
      const frames = readingOrder(board.elements().filter(element => element.type === 'frame'));
      if (!frames.length) {
        throw new Error('This board has no frames to present — read_board, and talk about it instead');
      }

      const named = name ? frameNamed(board, name) : undefined;
      if (name && !named) {
        throw new Error(
          `No frame "${name}" — the frames are: ${frames.map(frame => `"${frame.text ?? ''}"`).join(', ')}`
        );
      }

      const index = named
        ? frames.findIndex(frame => frame.id === named.id)
        : Math.min((presenting ?? -1) + 1, frames.length - 1);
      const frame = frames[index];
      const title = frame.text?.trim() || 'Frame';
      presenting = index;
      await board.present([frame.x, frame.y, frame.width, frame.height], index, frames.length, title);
      await board.glide(centre(frame));
      if (say) {
        await Promise.all([board.sayAtCursor(say), board.chatLine(say)]);
      }

      const frameMap = new Map(frames.map(each => [each.id, each]));
      const inside = frameContents(board.elements(), frame).slice(1);

      return text(
        [
          `Presenting ${index + 1} of ${frames.length}: "${title}"${index + 1 < frames.length ? ` — next: "${frames[index + 1].text ?? ''}"` : ' — the last one'}.`,
          inside.length ? 'In it:' : 'It is empty.',
          ...inside.map(element => describeElement(element, frameMap, board.faceDown))
        ].join('\n')
      );
    }
  );

  server.registerTool(
    'end_presentation',
    {
      title: 'End the presentation',
      description: 'Stop presenting: everyone is free to look around again.',
      inputSchema: {}
    },
    async () => {
      const board = onBoard();
      presenting = undefined;
      await board.present([0, 0, 0, 0], -1, 0, '');

      return text('The presentation is over.');
    }
  );

  server.registerTool(
    'branch_frame',
    {
      title: 'Branch a frame',
      description:
        'Copy a frame with everything in it — notes, cards, the arrows between them — to its right, as a branch: a ' +
        'place to try another way without touching the original. Asked for alternatives, make a branch for each and ' +
        "change it; the people pick one with merge_branch (or delete the others). Answers the branch frame's id.",
      inputSchema: {
        frame: z.string().describe('The frame, by id or title'),
        title: z.string().max(80).optional().describe('What this branch tries — e.g. "By team", "Cheaper option"')
      }
    },
    async ({ frame: name, title }) => {
      const board = onBoard();
      const frame = frameNamed(board, name);
      if (!frame) {
        throw new Error(`No frame "${name}" on the board — read_board for the frames`);
      }

      const copies = branchFrame(board.elements(), frame, board.topZ(), title);
      const [copy] = await board.commit(copies);
      await board.glide(centre(copy));

      return text(
        `Branched ${frame.id} into ${copy.id} "${copy.text ?? ''}" with ${copies.length - 1} element(s): change it there.`
      );
    }
  );

  server.registerTool(
    'merge_branch',
    {
      title: 'Take a branch back',
      description:
        'The branch that won replaces what its original frame held — the original keeps its place, title and duty — ' +
        'and the branch frame goes. Only when the people on the board chose it.',
      inputSchema: { branch: z.string().describe('The branch frame, by id or title') }
    },
    async ({ branch: name }) => {
      const board = onBoard();
      const branch = frameNamed(board, name);
      if (!branch?.branchOf) {
        throw new Error(`"${name}" is not a branch — read_board marks the frames that are`);
      }

      await board.commit(mergeBranch(board.elements(), branch));

      return text(`Took ${branch.id} back into ${branch.branchOf}.`);
    }
  );

  server.registerTool(
    'start_session',
    {
      title: 'Run a session',
      description:
        'Take the board through a session with a script, for everyone at once — you facilitate: ' +
        Object.entries(SCRIPTS)
          .map(([id, script]) => `${id} (${script.steps.map(step => `${step.kind} ${step.minutes} min`).join(', ')})`)
          .join('; ') +
        ". In a write step everyone writes on their own and the others' notes stay face down; reveal shows them; vote " +
        'is for the votes; discuss talks through the most voted. Say in the chat what each step is for, listen with ' +
        'wait_for_activity, and move on with session_next when its time is up (read_board shows what is left).',
      inputSchema: { script: z.enum(SCRIPT_IDS) }
    },
    async ({ script }) => {
      const board = onBoard();
      await board.runSession('start', script);

      return text(`Started a ${SCRIPTS[script].label} session. Step 1: ${SCRIPTS[script].steps[0].say}`);
    }
  );

  server.registerTool(
    'session_next',
    {
      title: 'Next step',
      description: "Move the board's session on to its next step — past the last, it is over.",
      inputSchema: {}
    },
    async () => {
      const board = onBoard();
      const running = board.session();
      if (!running) {
        throw new Error('No session is under way — start_session starts one');
      }

      await board.runSession('next');
      const { steps } = SCRIPTS[running.script];
      if (running.step + 1 >= steps.length) {
        return text('That was the last step: the session is over.');
      }

      const next = steps[running.step + 1];

      return text(`Step ${running.step + 2} of ${steps.length} — ${next.kind}: ${next.say}`);
    }
  );

  server.registerTool(
    'stop_session',
    { title: 'End the session', description: "End the board's session now, whatever step it is at.", inputSchema: {} },
    async () => {
      await onBoard().runSession('stop');

      return text('The session is over.');
    }
  );

  server.registerTool(
    'my_duties',
    {
      title: 'Your duties',
      description:
        'The standing jobs the people on the board set for agents in their frames — a scribe keeps a summary current, ' +
        'a guardian watches a rule, an organizer sorts what lands there — and which are yours or free to take. Take ' +
        'one with take_duty, then keep at it: wait_for_activity with its frame, act, and say briefly what you did.',
      inputSchema: {}
    },
    () => {
      const board = onBoard();
      const duties = board.elements().filter(element => element.type === 'frame' && element.duty && !element.deleted);
      if (!duties.length) {
        return text("No frame on this board has a duty for an agent. People set one from a frame's tools (the robot).");
      }

      return text(
        duties
          .map(frame => {
            const duty = frame.duty;
            if (!duty) {
              return '';
            }

            const holder = duty.agent === board.name ? 'yours' : duty.agent ? `taken by ${duty.agent}` : 'free';

            return `- ${frame.id} "${frame.text?.trim() || 'Frame'}" — ${DUTY_PRESETS[duty.role].label}, ${holder}${duty.paused ? ', PAUSED (wait until it is resumed)' : ''}: ${instructionOf(duty)}`;
          })
          .join('\n')
      );
    }
  );

  server.registerTool(
    'take_duty',
    {
      title: 'Take a duty',
      description:
        "Take a frame's duty (see my_duties): its badge says you are on it, and the chat is told. `release: true` " +
        'gives it back. A duty someone else took is theirs; a paused one waits.',
      inputSchema: {
        frame: z.string().describe('The frame, by id or title'),
        release: z.boolean().optional()
      }
    },
    async ({ frame: name, release }) => {
      const board = onBoard();
      const frame = frameNamed(board, name);
      const duty = frame?.duty;
      if (!frame || !duty) {
        throw new Error(`No frame "${name}" with a duty — my_duties lists them`);
      }

      if (duty.agent && duty.agent !== board.name) {
        throw new Error(`${frame.id} is ${duty.agent}'s duty. Leave it to them, or ask the people on the board.`);
      }

      if (duty.paused && !release) {
        throw new Error(`The duty in "${frame.text ?? ''}" is paused: wait until the people on the board resume it.`);
      }

      const { agent: _agent, ...rest } = duty;
      await board.commit([{ ...frame, duty: release ? rest : { ...rest, agent: board.name } }]);
      const role = DUTY_PRESETS[duty.role].label;
      await board.chatLine(
        release
          ? `✦ I have stepped down as ${role} in "${frame.text?.trim() || 'Frame'}".`
          : `✦ I am on duty in "${frame.text?.trim() || 'Frame'}" as ${role}.`
      );

      return text(
        release
          ? `Released the duty in ${frame.id}.`
          : `On duty in ${frame.id} as ${role}: ${instructionOf(duty)}\nNow: wait_for_activity with frames: ["${frame.id}"], and act on what changes.`
      );
    }
  );

  server.registerTool(
    'leave_board',
    {
      title: 'Leave the board',
      description: 'Leave the board: your cursor and name go from everyone’s screens.',
      inputSchema: {}
    },
    () => {
      session?.leave();
      session = undefined;

      return text('Left the board.');
    }
  );
};
