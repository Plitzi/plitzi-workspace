import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

import { createMcpLog, emptySpace, emptySpaceMessage, serverInstructions, unauthorizedSpaceMessage } from './helpers';
import { registerResources } from './resources';
import { tools } from './tools';
import { isCallToolResult } from '../ai/toolkit';

import type { Space } from './helpers';
import type { Persisters, ToolContext } from './tools';
import type { PreviewClient, ScreenshotClient } from './types';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { SSRAdapters, Environment, McpLogger } from '@plitzi/sdk-shared';

/** The MCP service is stateless: every request resolves its own `spaceId` (from the request JWT) and reads the
 *  space fresh through the adapters — schema and style are two documents, read/written independently. Both the
 *  spaceId and the space itself resolve lazily, so the public surface (handshake, tools-list, resources-list,
 *  and the space-independent guide / css-properties resources) works even when the request carries no auth —
 *  only a space-dependent tool/resource demands a spaceId, failing with `unauthorizedSpaceMessage` if none. */
export interface McpServerContext {
  adapters: SSRAdapters;
  getSpaceId: () => Promise<number | undefined>;
  /** How the visual-preview tools (plitzi_preview / plitzi_screenshot) reach the renderer. Absent → those tools
   *  report PREVIEW_UNAVAILABLE, so an MCP-only deployment without a renderer still runs every other tool. */
  preview?: PreviewClient;
  /** The dedicated browser service for plitzi_screenshot. Absent → the tool is not registered (only the HTML
   *  plitzi_preview is offered). */
  screenshot?: ScreenshotClient;
  /** Structured request-log sink. When set, every tool call and resource read emits an McpLogEvent to it (the
   *  consumer renders them); otherwise logging falls back to the console when MCP_DEBUG=1. */
  logger?: McpLogger;
}

// The MCP tools only ever operate on the active-editing environment.
const MCP_ENV: Environment = 'main';

const asText = (data: unknown): CallToolResult => ({ content: [{ type: 'text', text: JSON.stringify(data) }] });

export const createMcpServer = ({ adapters, getSpaceId, preview, screenshot, logger }: McpServerContext): McpServer => {
  const log = createMcpLog(logger);
  // Resolve the spaceId at most once, and only when a space-dependent operation actually needs it. A request
  // without a valid token fails here (not at connect time), so the public surface stays reachable.
  let spaceIdPromise: Promise<number> | undefined;
  const requireSpaceId = (): Promise<number> =>
    (spaceIdPromise ??= getSpaceId().then(id => {
      if (!id) {
        throw new Error(unauthorizedSpaceMessage);
      }

      return id;
    }));

  const loadSpace = async (): Promise<Space> => {
    const spaceId = await requireSpaceId();
    // The catalog is optional reference data (plugin type semantics); a failure to load it must never block the
    // space read, so it is fetched best-effort and degrades to built-in-only type descriptions.
    const [schema, style, catalog] = await Promise.all([
      adapters.getSchema?.(spaceId, MCP_ENV),
      adapters.getStyle?.(spaceId, MCP_ENV),
      adapters.getComponentCatalog?.(spaceId, MCP_ENV).catch(() => undefined)
    ]);
    if (!schema || !style) {
      throw new Error(emptySpaceMessage);
    }

    return { schema, style, catalog };
  };

  const { saveSchema, saveStyle } = adapters;
  const persisters: Persisters = {
    schema: saveSchema ? async schema => saveSchema(await requireSpaceId(), MCP_ENV, schema) : undefined,
    style: saveStyle ? async style => saveStyle(await requireSpaceId(), MCP_ENV, style) : undefined
  };

  // Load the space at most once per request, and only on first read/write — never for the handshake.
  let spacePromise: Promise<Space> | undefined;
  const getSpace = (): Promise<Space> => (spacePromise ??= loadSpace());

  const server = new McpServer({ name: 'plitzi-mcp', version: VERSION }, { instructions: serverInstructions });

  registerResources(server, getSpace, MCP_ENV, log);

  // Register every tool straight from the shared registry: identity + input schema + behavior come from each
  // tool's descriptor, so a new tool is picked up here with no per-tool wiring.
  const toolContext = async (): Promise<ToolContext> => ({
    space: await getSpace(),
    env: MCP_ENV,
    persisters,
    spaceId: await requireSpaceId(),
    preview,
    screenshot
  });

  // A space-independent tool (plitzi_render) must never trigger a spaceId/space load, so it stays callable with no
  // auth: hand it an empty placeholder space instead of resolving the request's. It authors its own throwaway one.
  const spacelessContext = (): ToolContext => ({ space: emptySpace(), env: MCP_ENV, persisters, preview, screenshot });
  for (const tool of tools) {
    // Skip a tool whose capability the host did not wire — e.g. plitzi_screenshot without a browser service, so
    // it never appears in tools/list when the feature is off.
    if (tool.requires === 'screenshot' && !screenshot) {
      continue;
    }

    server.registerTool(
      tool.name,
      { title: tool.title, description: tool.description, inputSchema: tool.inputShape },
      async (args: unknown) => {
        const start = performance.now();
        try {
          const result = await tool.execute(args, tool.spaceless ? spacelessContext() : await toolContext());
          log.toolCall(tool.name, args, performance.now() - start);

          return isCallToolResult(result) ? result : asText(result);
        } catch (error) {
          log.toolCall(tool.name, args, performance.now() - start, error);
          throw error;
        }
      }
    );
  }

  return server;
};
