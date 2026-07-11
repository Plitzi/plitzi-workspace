import { z } from 'zod';

import type { Space } from '../helpers';
import type { Env, Persisters } from '../types';
import type { ZodObject, ZodRawShape } from 'zod';

/** Everything a tool needs at call time: the loaded space, the target environment, and the persisters (only the
 *  write tools use them). Built by whoever hosts the tools — the standalone MCP server or the in-process AI
 *  engine — so a tool's behavior never touches spaceId resolution or adapters directly. */
export interface ToolContext {
  space: Space;
  env: Env;
  persisters: Persisters;
}

/** What a tool author writes: identity, the input schema that is the contract sent to the agent, and a typed
 *  `run` (its args are inferred from `inputShape`, so no cast). `access` marks whether it persists — a 'write'
 *  tool previews (dryRun) in plan mode and can persist in build mode; a 'read' tool never writes. */
export interface ToolSpec<Shape extends ZodRawShape> {
  name: string;
  title: string;
  description: string;
  inputShape: Shape;
  access: 'read' | 'write';
  run: (input: z.infer<ZodObject<Shape>>, ctx: ToolContext) => unknown;
}

/** What the registry holds and the hosts register from: the same metadata plus a type-erased `execute` that
 *  validates raw args against the shape and delegates to the typed `run`. Produced by `defineTool`. */
export interface ToolDef {
  name: string;
  title: string;
  description: string;
  inputShape: ZodRawShape;
  access: 'read' | 'write';
  execute: (args: unknown, ctx: ToolContext) => unknown;
}

/** Author a tool: give it its metadata, its input shape and a typed `run`. The returned descriptor parses the
 *  raw args against the shape before handing them to `run`, so `run` is fully typed and no cast is needed.
 *  Adding a tool is: call defineTool in its own file and append it to the `tools` registry. */
export const defineTool = <Shape extends ZodRawShape>(spec: ToolSpec<Shape>): ToolDef => ({
  name: spec.name,
  title: spec.title,
  description: spec.description,
  inputShape: spec.inputShape,
  access: spec.access,
  execute: (args, ctx) => spec.run(z.object(spec.inputShape).parse(args), ctx)
});
