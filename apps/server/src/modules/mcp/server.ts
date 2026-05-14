import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

import * as defaultTools from './tools';
import PACKAGE from '../../../package.json' with { type: 'json' };

import type AIEngine from '../ai/AIEngine';
import type { McpAdapters, McpTool, McpToolAdapterDefinition, McpPrompt } from '@plitzi/sdk-shared';

export const createMcpServer = (
  adapters: Partial<McpAdapters> = {},
  engine: AIEngine,
  tools?: (McpTool | McpToolAdapterDefinition)[],
  prompts?: McpPrompt[]
) => {
  const server = new McpServer({ name: 'plitzi-mcp', version: PACKAGE.version });
  for (const tool of Object.values(defaultTools)) {
    const { name, adapterName, description, inputSchema } = tool;
    server.registerTool(name, { description, inputSchema }, engine.executeAdapter(adapterName, adapters));
  }

  if (tools) {
    for (const tool of tools) {
      if ('adapterName' in tool) {
        server.registerTool(
          tool.name,
          { description: tool.description, inputSchema: tool.inputSchema },
          engine.executeAdapter(tool.adapterName, adapters)
        );
      } else {
        server.registerTool(tool.name, tool.definition, engine.executeTool(tool.name, tool.handler));
      }
    }
  }

  if (prompts) {
    for (const prompt of prompts) {
      server.registerPrompt(prompt.name, prompt.definition, engine.executePrompt(prompt.name, prompt.handler));
    }
  }

  return server;
};
