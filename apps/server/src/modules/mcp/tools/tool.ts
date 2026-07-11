import type { Space } from '../helpers';
import type { Env, Persisters } from '../types';
import type { ZodRawShape } from 'zod';

/** Everything a tool needs at call time: the loaded space, the target environment, and the persisters (only the
 *  write tools use them). Built by whoever hosts the tools — the standalone MCP server or the in-process AI
 *  engine — so a tool's `run` never touches spaceId resolution or adapters directly. */
export interface ToolContext {
  space: Space;
  env: Env;
  persisters: Persisters;
}

/** A single, self-describing MCP tool: its identity, the input schema that is the contract sent to the agent,
 *  and its behavior. Both hosts register tools straight from this list, so adding a tool is: write one file with
 *  its descriptor and add it to the `tools` registry — nothing else to wire.
 *
 *  `access` marks whether the tool persists: a 'write' tool previews (dryRun) in plan mode and can persist in
 *  build mode; a 'read' tool never writes. `run` receives the args already validated against `inputShape` by the
 *  host, hence the cast each tool does to its own input type. */
export interface ToolDef {
  name: string;
  title: string;
  description: string;
  inputShape: ZodRawShape;
  access: 'read' | 'write';
  run: (args: unknown, ctx: ToolContext) => unknown;
}
