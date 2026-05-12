import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

import { registerBuiltInTools, wrapHandler } from './helpers';
import PACKAGE from '../../../package.json' with { type: 'json' };

import type { McpAdapters, McpToolConfig, McpPromptConfig, McpContext } from '@plitzi/sdk-shared';

export const createMcpServer = (
  adapters: Partial<McpAdapters> = {},
  context: McpContext,
  tools?: McpToolConfig[],
  prompts?: McpPromptConfig[]
) => {
  const server = new McpServer({ name: 'plitzi-mcp', version: PACKAGE.version });
  registerBuiltInTools(server, adapters, context);
  if (tools) {
    for (const tool of tools) {
      server.registerTool(tool.name, tool.definition, wrapHandler(tool.handler, context));
    }
  }

  if (prompts) {
    for (const prompt of prompts) {
      server.registerPrompt(prompt.name, prompt.definition, wrapHandler(prompt.handler, context));
    }
  }

  return server;
};
