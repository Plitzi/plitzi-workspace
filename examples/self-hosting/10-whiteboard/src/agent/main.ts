import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createAgentServer } from './server.ts';
import { doorTo, parseLink } from './session.ts';
import { COLLAB_COLOURS } from '../board/people.ts';

/**
 * Pizarra for agents, over stdio, from a checkout of this example — for working on Pizarra itself:
 *
 *     claude mcp add pizarra -- node examples/self-hosting/10-whiteboard/src/agent/main.ts
 *
 * The people on a board need none of this: every Pizarra serves the same agent at `/mcp` (`hosted.ts`), and its
 * invite panel says how to add it. This one runs on the developer's machine and joins a board on any Pizarra it is
 * given a link to, as a browser there would.
 *
 * - `PIZARRA_URL`: where a bare board id is looked for, and new boards are started. Default `http://127.0.0.1:4016`.
 * - `PIZARRA_AGENT_NAME`: the name the people on the board see. Default `Claude`.
 * - `PIZARRA_AGENT_COLOR`: one of the room's colours. Default `orchid`.
 */

const name = process.env.PIZARRA_AGENT_NAME?.trim() || 'Claude';
const requested = process.env.PIZARRA_AGENT_COLOR;
const color = COLLAB_COLOURS.find(colour => colour === requested) ?? 'orchid';
const home = doorTo(process.env.PIZARRA_URL ?? 'http://127.0.0.1:4016');

const agent = createAgentServer({
  home,
  locate: link => {
    const { origin, board, key } = parseLink(link, home.origin);

    return { door: doorTo(origin), board, ...(key ? { key } : {}) };
  },
  identity: () => ({ name, color })
});

// Stdout is the protocol's: anything said to a person goes to stderr.
await agent.connect(new StdioServerTransport());
// Its client gone — the app closed, the terminal quit — it is gone from the board too, and says so.
agent.server.server.onclose = () => agent.leave('my app closed the connection');
console.error(`[pizarra agent] ready as ${name} (${color})`);
