import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

import { bindTools } from './helpers';
import { registerResources } from './resources';
import * as defaultTools from './tools';
import PACKAGE from '../../../package.json' with { type: 'json' };

import type AIEngine from '../ai/AIEngine';
import type { McpAdapters, McpTool, McpPrompt, McpResource } from '@plitzi/sdk-shared';

export const createMcpServer = (
  adapters: Partial<McpAdapters> = {},
  engine: AIEngine,
  tools?: McpTool[],
  prompts?: McpPrompt[],
  resources?: McpResource[]
) => {
  // Bind once: every tool now carries a handler (adapter tools get the adapter wrapped in), so
  // registration is uniform and unusable tools (missing adapter) are dropped.
  const boundTools = bindTools([...Object.values(defaultTools), ...(tools ?? [])], adapters);
  const server = new McpServer({ name: 'plitzi-mcp', version: PACKAGE.version });
  engine.setToolsAvailables(boundTools);
  registerResources(server, resources, engine.readResource);

  for (const tool of boundTools) {
    // Only expose tools permitted in the current mode (e.g. hide write tools in plan mode), so the
    // MCP tool set matches what the direct providers advertise via getActiveTools.
    if (!engine.can(tool.name)) {
      continue;
    }

    // outputSchema is intentionally omitted from the MCP registration: the SDK would force
    // every result to carry an object-shaped structuredContent and reject boolean/array/empty
    // payloads. Output validation is handled uniformly across all providers by AIEngine instead.
    const { title, description, inputSchema, annotations } = tool.mcpDefinition;
    const definition = { title, description, inputSchema, annotations };

    server.registerTool(tool.name, definition, engine.execute(tool.name, tool.handler));
  }

  if (prompts) {
    for (const prompt of prompts) {
      server.registerPrompt(prompt.name, prompt.definition, engine.executePrompt(prompt.name, prompt.handler));
    }
  }

  return server;
};
