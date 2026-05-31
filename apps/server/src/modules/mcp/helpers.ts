import { z } from 'zod';

import type {
  AiContext,
  AiMode,
  McpAdapter,
  McpAdapters,
  McpTool,
  McpToolHandler,
  McpToolHandlerResult,
  ToolOperationType
} from '@plitzi/sdk-shared';

export const zodToJsonSchema = (schema: unknown): Record<string, unknown> => {
  if (schema instanceof z.ZodObject) {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(schema.shape)) {
      const propSchema = zodToJsonSchema(value as z.ZodTypeAny);
      properties[key] = propSchema;

      if (value instanceof z.ZodString || value instanceof z.ZodNumber || value instanceof z.ZodBoolean) {
        if (!value.isOptional()) {
          required.push(key);
        }
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : []
    };
  }

  if (schema instanceof z.ZodString) {
    return { type: 'string' };
  }

  if (schema instanceof z.ZodNumber) {
    return { type: 'number' };
  }

  if (schema instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }

  if (schema instanceof z.ZodEnum) {
    return { type: 'string', enum: schema.options };
  }

  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchema((schema as unknown as { _def: { innerType: z.ZodTypeAny } })._def.innerType);
  }

  if (schema instanceof z.ZodUnion) {
    return { oneOf: schema.options.map(opt => zodToJsonSchema(opt)) };
  }

  if (schema instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodToJsonSchema(schema.element)
    };
  }

  if (schema instanceof z.ZodRecord) {
    return {
      type: 'object',
      additionalProperties: zodToJsonSchema(schema.valueType)
    };
  }

  return {};
};

export const getAllowedModes = (operationType: ToolOperationType): AiMode[] => {
  return operationType === 'write' ? ['build'] : ['plan', 'build'];
};

export const toolResponseOk = (data: unknown, agentMessage?: string): McpToolHandlerResult => {
  // data is stored for the frontend renderer (via onToolSuccess) and never sent directly to the AI agent.
  // agentMessage controls what the agent reads — a brief confirmation for visual tools,
  // or the full JSON serialization when omitted (for info tools the agent must read).
  const text = agentMessage ?? JSON.stringify(data ?? null, null, 2);

  return { content: [{ type: 'text' as const, text }], data };
};

export const toolResponseErr = (error: Error | string): McpToolHandlerResult => ({
  content: [{ type: 'text' as const, text: error instanceof Error ? error.message : error }],
  isError: true as const
});

// A tool is usable when it has a direct handler or its declared adapter is registered.
export const isToolActive = (tool: McpTool, adapters: Partial<McpAdapters>): boolean =>
  Boolean(tool.handler || (tool.adapterName && adapters[tool.adapterName]));

// Resolve the single execution path for a tool: its own handler, or the adapter wrapped as a handler.
export const resolveToolHandler = (tool: McpTool, adapters: Partial<McpAdapters>): McpToolHandler | undefined => {
  if (tool.handler) {
    return tool.handler;
  }

  if (tool.adapterName) {
    return adapterWrapper(tool.adapterName, adapters[tool.adapterName] as McpAdapter | undefined);
  }

  return undefined;
};

// Bind a list of tools against the runtime adapters: keeps only usable tools and gives each a
// guaranteed handler, so every consumer (MCP server, providers, direct callers) runs them identically.
export const bindTools = (tools: McpTool[], adapters: Partial<McpAdapters>): McpTool[] =>
  tools
    .filter(tool => isToolActive(tool, adapters))
    .map(tool => ({ ...tool, handler: resolveToolHandler(tool, adapters) }));

export const adapterWrapper = (adapterName: string, handler?: McpAdapter): McpToolHandler => {
  return async (args: Record<string, unknown>, ctx: AiContext) => {
    if (!handler) {
      return toolResponseErr(`Adapter ${adapterName} not found`);
    }

    const result = await handler(args, ctx);
    if ('error' in result) {
      return toolResponseErr(result.error);
    }

    return toolResponseOk(result.data);
  };
};
