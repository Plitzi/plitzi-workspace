import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

import { adapterWrapper } from './helpers';
import { registerResources } from './resources';
import * as defaultTools from './tools';
import PACKAGE from '../../../package.json' with { type: 'json' };

import type AIEngine from '../ai/AIEngine';
import type { McpAdapters, McpTool, McpPrompt, McpResource, McpAdapter } from '@plitzi/sdk-shared';

export const createMcpServer = (
  adapters: Partial<McpAdapters> = {},
  engine: AIEngine,
  tools?: McpTool[],
  prompts?: McpPrompt[],
  resources?: McpResource[]
) => {
  tools = [...Object.values(defaultTools), ...(tools ?? [])];
  const server = new McpServer({ name: 'plitzi-mcp', version: PACKAGE.version });
  engine.setToolsAvailables(tools);
  registerResources(server, resources, engine.readResource);

  for (const tool of tools) {
    if ('adapterName' in tool && tool.adapterName && adapters[tool.adapterName]) {
      server.registerTool(
        tool.name,
        tool.mcpDefinition,
        engine.execute(tool.name, adapterWrapper(tool.adapterName, adapters[tool.adapterName] as McpAdapter))
      );
    } else if ('handler' in tool) {
      server.registerTool(tool.name, tool.mcpDefinition, engine.execute(tool.name, tool.handler));
    }
  }

  if (prompts) {
    for (const prompt of prompts) {
      server.registerPrompt(prompt.name, prompt.definition, engine.executePrompt(prompt.name, prompt.handler));
    }
  }

  return server;
};
