import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { COLLAB_COLOURS } from '../board/people.ts';
import { registerTools } from './tools.ts';

/**
 * Pizarra for agents: an MCP server, over stdio, that lets an agent join a board as a collaborator.
 *
 *     claude mcp add pizarra -- node examples/06-full-examples/04-whiteboard/src/agent/main.ts
 *
 * Then give the agent a board link. It appears on the board by name, with a cursor the people there watch move; it
 * reads what is there, adds notes, cards, frames, shapes and arrows, answers comments, and talks in the board's chat.
 * It is a client of the board's server like a browser is — the same actions, the same channels — so it works against
 * any Pizarra, one process or several replicas behind a balancer.
 *
 * - `PIZARRA_URL`: where a bare board id is looked for, and new boards are started. Default `http://127.0.0.1:4016`.
 * - `PIZARRA_AGENT_NAME`: the name the people on the board see. Default `Claude`.
 * - `PIZARRA_AGENT_COLOR`: one of the room's colours. Default `orchid`.
 */

const INSTRUCTIONS = `You are a collaborator on a Pizarra whiteboard, alongside people who see everything you do as it happens: your name, your cursor moving, what you add, what you say.

Work as a considerate teammate:
- join_board first (the link someone gave you), and read what is there before changing it.
- Say what you are about to do in a line (say), then do it — people should never be surprised by a board rearranging itself.
- Add in batches (add_elements takes many at once). Leave x/y out and things are placed in free space; name a frame to put things in it.
- Kanban: a frame with layout "column" stacks what is put in it. Cards have a done box (update_elements done: true).
- Connect ideas with connect, point at what you mean with point_at, and answer comments with reply_to_comment.
- To hold a conversation, say something and then wait_for_activity: it answers what people said in the chat or at their cursors.
- Never delete what others made unless they asked.`;

const name = process.env.PIZARRA_AGENT_NAME?.trim() || 'Claude';
const requested = process.env.PIZARRA_AGENT_COLOR;
const color = COLLAB_COLOURS.find(colour => colour === requested) ?? 'orchid';

const server = new McpServer({ name: 'pizarra', version: '1.0.0' }, { instructions: INSTRUCTIONS });
registerTools(server, { server: process.env.PIZARRA_URL ?? 'http://127.0.0.1:4016', name, color });

// Stdout is the protocol's: anything said to a person goes to stderr.
await server.connect(new StdioServerTransport());
console.error(`[pizarra agent] ready as ${name} (${color})`);
