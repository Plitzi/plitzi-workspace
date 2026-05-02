import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerBuiltInTools } from './helpers';

import type { AnySchema, ZodRawShapeCompat } from '@modelcontextprotocol/sdk/server/zod-compat';
import type { McpAdapters, McpToolConfig } from '@plitzi/sdk-shared';

export const createMcpServer = (adapters: McpAdapters, tools?: McpToolConfig[]): McpServer => {
  const server = new McpServer({ name: 'plitzi-schema-agent', version: '1.0.0' });

  registerBuiltInTools(server, adapters);

  if (tools) {
    for (const tool of tools) {
      server.registerTool(
        tool.name,
        { description: tool.description, inputSchema: tool.inputSchema as AnySchema | ZodRawShapeCompat | undefined },
        tool.handler
      );
    }
  }

  return server;
};
