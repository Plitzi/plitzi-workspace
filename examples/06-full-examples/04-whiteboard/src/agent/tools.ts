import { z } from 'zod';

import { REACTIONS } from '../board/reactions.ts';
import { TEMPLATES } from '../board/templates.ts';
import { releasedFrom } from '../plugins/Board/connectors.ts';
import { layoutColumn, membersOf, moved } from '../plugins/Board/containers.ts';
import { anchorPoint, boundsOf, nearestAnchor } from '../plugins/Board/geometry.ts';
import { restyled } from '../plugins/Board/styling.ts';
import { describeBoard, describeElement } from './describe.ts';
import { cardHeight, frameNamed, placeAll } from './place.ts';
import { callAction, joinBoard, newElementId, parseLink } from './session.ts';

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
  'star'
] as const;

const COLOURS = 'yellow, red, orange, green, blue, violet (notes, cards, frames, fills); ink for text and outlines';

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
    'add_elements',
    {
      title: 'Add to the board',
      description:
        'Put things on the board, all at once: sticky notes, cards (tasks, with a done box), text, frames (sections — ' +
        'a frame with layout "column" is a kanban lane that stacks what is put in it), comments, and shapes with a ' +
        'label. Give `frame` (its id or title) to put something in a frame; give x/y only to place it exactly — ' +
        `left out, it is placed in free space for you. Colours: ${COLOURS}. Answers each new element's id.`,
      inputSchema: {
        elements: z
          .array(
            z.object({
              type: z.enum(ELEMENT_TYPES),
              text: z.string().max(4000).optional().describe('What it says — a frame’s title, a shape’s label'),
              frame: z.string().optional().describe('Id or title of the frame to put it in'),
              x: z.number().optional(),
              y: z.number().optional(),
              width: z.number().positive().optional(),
              height: z.number().positive().optional(),
              color: z.string().optional(),
              layout: z.enum(['column']).optional().describe('Frames only: stack what is put in it'),
              done: z.boolean().optional().describe('Cards: already done')
            })
          )
          .min(1)
          .max(100)
      }
    },
    async ({ elements }) => {
      const board = onBoard();
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

      return text(`Added ${added.length}:\n${added.map(element => describeElement(element, frames)).join('\n')}`);
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
        'Change elements by id: their text, place, size, colour; tick a card done or resolve a comment; move ' +
        'something into a frame (by id or title — a column places it); make a frame a column.',
      inputSchema: {
        changes: z
          .array(
            z.object({
              id: z.string(),
              text: z.string().max(4000).optional(),
              x: z.number().optional(),
              y: z.number().optional(),
              width: z.number().positive().optional(),
              height: z.number().positive().optional(),
              color: z.string().optional(),
              done: z.boolean().optional(),
              frame: z.string().optional().describe('Id or title of the frame to move it into; "" takes it out'),
              layout: z.enum(['column', 'free']).optional().describe('Frames only')
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

        const { done: _done, parent: _parent, layout: _layout, ...rest } = current;
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
        const frame = change.frame === undefined ? undefined : frameNamed(board, change.frame);
        const parent = change.frame === undefined ? current.parent : frame?.id;
        element = {
          ...element,
          ...(done ? { done: true } : {}),
          ...(layout ? { layout } : {}),
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

      // Columns something entered, left or changed in are laid out again, as a canvas would.
      const all = new Map(board.elements().map(element => [element.id, element]));
      next.forEach((element, id) => all.set(id, element));
      const columns = new Set(
        [...next.values()].flatMap(element => [element.parent, board.element(element.id)?.parent].filter(Boolean))
      );
      for (const id of columns) {
        const column = id ? all.get(id) : undefined;
        if (column?.layout === 'column') {
          const width = column.width - 28;
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
      description: 'Remove elements by id. Arrows fixed to them stay, let go where they are.',
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
      inputSchema: { seconds: z.number().min(0).max(120).optional().describe('How long to wait at most; default 30') }
    },
    async ({ seconds = 30 }) => {
      const board = onBoard();
      const since = lastLooked;
      const heard = await board.activitySince(since, seconds * 1000);
      lastLooked = Date.now();

      return text(heard.length ? heard.map(describeActivity).join('\n') : `Nothing happened in ${seconds} seconds.`);
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
