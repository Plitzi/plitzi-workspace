import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

import { registerResources } from './resources';
import { serverInstructions } from './resources/guide';
import { apply, applyShape, preview, search, searchShape, validate, validateShape } from './tools';

import type { Space } from './helpers';
import type { Persisters } from './tools';
import type { Env } from './types';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Schema, Style } from '@plitzi/sdk-shared';

/** The two Plitzi schemas the platform stores and persists separately, plus a persister for each. */
export interface McpState {
  env: Env;
  schema: Schema;
  style: Style;
  persistSchema?: (schema: Schema) => Promise<void>;
  persistStyle?: (style: Style) => Promise<void>;
}

const asText = (data: unknown): CallToolResult => ({ content: [{ type: 'text', text: JSON.stringify(data) }] });

export const createMcpServer = (state: McpState): McpServer => {
  const { env } = state;
  const space: Space = { schema: state.schema, style: state.style };
  const persisters: Persisters = { schema: state.persistSchema, style: state.persistStyle };
  const server = new McpServer({ name: 'plitzi-mcp', version: '0.3.0' }, { instructions: serverInstructions });

  registerResources(server, space, env);

  server.registerTool(
    'plitzi_apply',
    {
      title: 'Apply',
      description:
        'Validate, apply and persist a batch of operations atomically. Returns the changed resources and their ' +
        'new versions. Rejects the whole batch on any error or version conflict.',
      inputSchema: applyShape
    },
    async args => asText(await apply(args, space, persisters))
  );

  server.registerTool(
    'plitzi_preview',
    {
      title: 'Preview',
      description: 'Validate and apply a batch in memory without persisting. Returns the resources it would change.',
      inputSchema: applyShape
    },
    args => asText(preview(args, space))
  );

  server.registerTool(
    'plitzi_validate',
    {
      title: 'Validate',
      description: 'Check a batch of operations without executing them. Returns teachable errors and warnings.',
      inputSchema: validateShape
    },
    args => asText(validate(args, space))
  );

  server.registerTool(
    'plitzi_search',
    {
      title: 'Search',
      description: 'Find elements by label, type or attribute value across all pages.',
      inputSchema: searchShape
    },
    args => asText(search(args, space))
  );

  return server;
};
