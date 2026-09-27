import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { observeToolCalls } from './observe.ts';
import { registerTools } from './tools.ts';

import type { AgentOptions } from './tools.ts';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

/**
 * Pizarra for agents: one MCP server, whichever way an agent reaches it — over HTTP from the board's own server
 * (`hosted.ts`, what anyone on a board is told to add), or over stdio from a checkout of this example (`main.ts`,
 * for working on Pizarra itself). The same instructions and the same tools; only where a board is reached differs.
 */

const INSTRUCTIONS = `You are a collaborator on a Pizarra whiteboard, alongside people who see everything you do as it happens: your name, your cursor moving, what you add, what you say.

Work as a considerate teammate:
- join_board first (the link someone gave you), and read what is there before changing it.
- Say what you are about to do in a line (say), then do it — people should never be surprised by a board rearranging itself.
- Add in batches (add_elements takes many at once). Leave x/y out and things are placed in free space; name a frame to put things in it.
- Kanban: a frame with layout "column" stacks what is put in it. Cards have a done box (update_elements done: true); a column that completes ticks off what is moved into it.
- Connect ideas with connect, point at what you mean with point_at, and answer comments with reply_to_comment.
- To hold a conversation, say something and then wait_for_activity: it answers what people said in the chat or at their cursors. Keep calling it while the people want you around — you stay on the board between calls, and the people see you listening.
- You leave on your own when someone asks you to (leave_board), when nobody else is on the board, or after the board's quiet time; a tool then says why.
- Never delete what others made unless they asked.`;

export type AgentServer = {
  server: McpServer;
  /** Serves the agent over `transport`, its tool calls watched for what the people on the board see it doing. */
  connect: (transport: Transport) => Promise<void>;
  /** Whether it is on a board now: an agent on one stays while the board wants it, however quiet its client is. */
  present: () => boolean;
  /** Takes the agent off its board, saying `reason` in the chat: its client closed the session, or went for good. */
  leave: (reason: string) => void;
};

export const createAgentServer = (options: AgentOptions): AgentServer => {
  const server = new McpServer({ name: 'pizarra', version: '1.0.0' }, { instructions: INSTRUCTIONS });
  const tools = registerTools(server, options);

  return {
    server,
    connect: transport => server.connect(observeToolCalls(transport, tools.called)),
    present: tools.present,
    leave: tools.leave
  };
};
