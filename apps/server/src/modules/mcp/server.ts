import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

import { emptySpaceMessage } from './helpers';
import { registerResources } from './resources';
import { serverInstructions } from './resources/guide';
import { apply, applyShape, preview, search, searchShape, validate, validateShape } from './tools';

import type { Space } from './helpers';
import type { Persisters } from './tools';
import type { Env } from './types';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { SSRAdapters } from '@plitzi/sdk-shared';

/** The MCP service is stateless: every request resolves its own `spaceId` (from the request JWT) and reads the
 *  space fresh through the adapters — schema and style are two documents, read/written independently. Reads are
 *  lazy so the handshake / tools-list / resources-list never touch the store. */
export interface McpServerContext {
  adapters: SSRAdapters;
  spaceId: number;
}

// The MCP tools only ever operate on the active-editing environment.
const MCP_ENV: Env = 'main';

const asText = (data: unknown): CallToolResult => ({ content: [{ type: 'text', text: JSON.stringify(data) }] });

export const createMcpServer = ({ adapters, spaceId }: McpServerContext): McpServer => {
  const loadSpace = async (): Promise<Space> => {
    const [schema, style] = await Promise.all([
      adapters.getSchema?.(spaceId, MCP_ENV),
      adapters.getStyle?.(spaceId, MCP_ENV)
    ]);
    if (!schema || !style) {
      throw new Error(emptySpaceMessage);
    }

    return { schema, style };
  };

  const { saveSchema, saveStyle } = adapters;
  const persisters: Persisters = {
    schema: saveSchema ? schema => saveSchema(spaceId, MCP_ENV, schema) : undefined,
    style: saveStyle ? style => saveStyle(spaceId, MCP_ENV, style) : undefined
  };

  // Load the space at most once per request, and only on first read/write — never for the handshake.
  let spacePromise: Promise<Space> | undefined;
  const getSpace = (): Promise<Space> => (spacePromise ??= loadSpace());

  const server = new McpServer({ name: 'plitzi-mcp', version: '0.3.0' }, { instructions: serverInstructions });

  registerResources(server, getSpace, MCP_ENV);

  server.registerTool(
    'plitzi_apply',
    {
      title: 'Apply',
      description:
        'Validate, apply and persist a batch of operations atomically. Returns the changed resources and their ' +
        'new versions. Rejects the whole batch on any error or version conflict.',
      inputSchema: applyShape
    },
    async args => asText(await apply(args, await getSpace(), persisters))
  );

  server.registerTool(
    'plitzi_preview',
    {
      title: 'Preview',
      description: 'Validate and apply a batch in memory without persisting. Returns the resources it would change.',
      inputSchema: applyShape
    },
    async args => asText(preview(args, await getSpace()))
  );

  server.registerTool(
    'plitzi_validate',
    {
      title: 'Validate',
      description: 'Check a batch of operations without executing them. Returns teachable errors and warnings.',
      inputSchema: validateShape
    },
    async args => asText(validate(args, await getSpace()))
  );

  server.registerTool(
    'plitzi_search',
    {
      title: 'Search',
      description: 'Find elements by label, type or attribute value across all pages.',
      inputSchema: searchShape
    },
    async args => asText(search(args, await getSpace()))
  );

  return server;
};
