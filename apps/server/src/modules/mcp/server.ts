import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

import { adapterWrapper } from './helpers';
import * as defaultTools from './tools';
import PACKAGE from '../../../package.json' with { type: 'json' };

import type AIEngine from '../ai/AIEngine';
import type { McpAdapters, McpTool, McpPrompt } from '@plitzi/sdk-shared';

export const createMcpServer = (
  adapters: Partial<McpAdapters> = {},
  engine: AIEngine,
  tools?: McpTool[],
  prompts?: McpPrompt[]
) => {
  tools = [...Object.values(defaultTools), ...(tools ?? [])];
  const server = new McpServer({ name: 'plitzi-mcp', version: PACKAGE.version });
  engine.setToolsAvailables(tools);

  for (const tool of tools) {
    if ('adapterName' in tool && tool.adapterName && adapters[tool.adapterName]) {
      server.registerTool(
        tool.name,
        tool.mcpDefinition,
        engine.executeTool(tool.name, adapterWrapper(tool.adapterName, adapters[tool.adapterName]))
      );
    } else if ('handler' in tool) {
      server.registerTool(tool.name, tool.mcpDefinition, engine.executeTool(tool.name, tool.handler));
    }
  }

  if (prompts) {
    for (const prompt of prompts) {
      server.registerPrompt(prompt.name, prompt.definition, engine.executePrompt(prompt.name, prompt.handler));
    }
  }

  return server;
};
