import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerApps } from './apps';
import {
  createMcpLog,
  emptySpace,
  emptySpaceMessage,
  noSpaceError,
  NoSpaceError,
  serverInstructions,
  widgetsOnlyInstructions
} from './helpers';
import { registerResources } from './resources';
import { tools } from './tools';
import { isCallToolResult } from '../ai/toolkit';

import type { Space } from './helpers';
import type { Persisters, ToolContext, ToolDef } from './tools';
import type { PreviewClient, ScreenshotClient } from './types';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { SSRAdapters, Environment, ServerLogger } from '@plitzi/sdk-shared';

/** The MCP service is stateless: every request resolves its own `spaceId` (from the request JWT) and reads the
 *  space fresh through the adapters — schema and style are two documents, read/written independently. The spaceId
 *  is resolved once per request, up front, because it decides what this connection IS: with a space, the full
 *  editing server; without one (no auth, a guest connection, a widgets-only grant), a widget server that offers
 *  only what works there. The space documents themselves still load lazily — the handshake and the listings never
 *  touch the store. */
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
  logger?: ServerLogger;
  /** May the plitzi_render view paint from tool arguments the host is still streaming (see `mcpAi.renderStreaming`)?
   *  Defaults to true. */
  renderStreaming?: boolean;
}

// The MCP tools only ever operate on the active-editing environment.
const MCP_ENV: Environment = 'main';

const asText = (data: unknown): CallToolResult => ({ content: [{ type: 'text', text: JSON.stringify(data) }] });

export const createMcpServer = async ({
  adapters,
  getSpaceId,
  preview,
  screenshot,
  logger,
  renderStreaming = true
}: McpServerContext): Promise<McpServer> => {
  const log = createMcpLog(logger);
  // What this connection reaches, resolved once for the whole request. A token that cannot be verified is not an
  // error here — it is simply a connection with no space, which is a supported way to use this server.
  const spaceId = await getSpaceId().catch(() => undefined);
  const hasSpace = spaceId !== undefined;
  const requireSpaceId = (): number => {
    if (spaceId === undefined) {
      throw new NoSpaceError();
    }

    return spaceId;
  };

  const loadSpace = async (): Promise<Space> => {
    const id = requireSpaceId();
    // The catalog is optional reference data (plugin type semantics); a failure to load it must never block the
    // space read, so it is fetched best-effort and degrades to built-in-only type descriptions.
    const [schema, style, catalog] = await Promise.all([
      adapters.getSchema?.(id, MCP_ENV),
      adapters.getStyle?.(id, MCP_ENV),
      adapters.getComponentCatalog?.(id, MCP_ENV).catch(() => undefined)
    ]);
    if (!schema || !style) {
      throw new Error(emptySpaceMessage);
    }

    return { schema, style, catalog };
  };

  const { saveSchema, saveStyle } = adapters;
  const persisters: Persisters = {
    schema: saveSchema ? schema => saveSchema(requireSpaceId(), MCP_ENV, schema) : undefined,
    style: saveStyle ? style => saveStyle(requireSpaceId(), MCP_ENV, style) : undefined
  };

  // Load the space at most once per request, and only on first read/write — never for the handshake.
  let spacePromise: Promise<Space> | undefined;
  const getSpace = (): Promise<Space> => (spacePromise ??= loadSpace());

  const server = new McpServer(
    { name: 'plitzi-mcp', version: VERSION },
    { instructions: hasSpace ? serverInstructions : widgetsOnlyInstructions }
  );

  registerResources(server, getSpace, MCP_ENV, log, hasSpace);

  // Every MCP App's ui:// page. They carry their own script and styles, so they are always registered; the
  // settings are the deployment's, not the connection's, and only change what the page hands the view.
  registerApps(server, { streaming: renderStreaming });

  // Register every tool straight from the shared registry: identity + input schema + behavior come from each
  // tool's descriptor, so a new tool is picked up here with no per-tool wiring.
  const toolContext = async (): Promise<ToolContext> => ({
    space: await getSpace(),
    env: MCP_ENV,
    persisters,
    spaceId: requireSpaceId(),
    preview,
    screenshot
  });

  // A space-independent tool (plitzi_render) must never trigger a spaceId/space load, so it stays callable with no
  // auth: hand it an empty placeholder space instead of resolving the request's. It authors its own throwaway one.
  const spacelessContext = (): ToolContext => ({ space: emptySpace(), env: MCP_ENV, persisters, preview, screenshot });

  // What a tool does on THIS connection: its own behavior when a space is attached; its public one (or nothing at
  // all, so it is never advertised) when none is.
  const behaviorOf = (tool: ToolDef): ((args: unknown) => unknown) | undefined => {
    if (tool.spaceless) {
      return args => tool.execute(args, spacelessContext());
    }

    if (hasSpace) {
      return async args => tool.execute(args, await toolContext());
    }

    return tool.executePublic ? args => tool.executePublic?.(args, MCP_ENV) : undefined;
  };

  for (const tool of tools) {
    // Skip a tool whose capability the host did not wire — e.g. plitzi_screenshot without a browser service, so
    // it never appears in tools/list when the feature is off.
    if (tool.requires === 'screenshot' && !screenshot) {
      continue;
    }

    const behavior = behaviorOf(tool);
    if (!behavior) {
      continue;
    }

    const run = async (args: unknown) => {
      const start = performance.now();
      try {
        const result = await behavior(args);
        log.toolCall(tool.name, args, performance.now() - start);

        return isCallToolResult(result) ? result : asText(result);
      } catch (error) {
        log.toolCall(tool.name, args, performance.now() - start, error);
        // A connection with no space is a state, not a failure: hosts render a failed tool call as "cannot connect
        // to this server", which tells the user their integration is broken when it is merely a guest grant. Said
        // as a plain result instead, so the agent reads it and the user is not misled.
        if (error instanceof NoSpaceError) {
          return asText({ error: noSpaceError, message: error.message });
        }

        throw error;
      }
    };

    const config = { title: tool.title, description: tool.description, inputSchema: tool.inputShape };
    if (tool.ui) {
      // MCP Apps: advertise the interactive view (its ui:// resource is always registered — see registerRenderApp).
      // registerAppTool also mirrors the URI onto the legacy flat `ui/resourceUri` key older hosts still read.
      registerAppTool(server, tool.name, { ...config, _meta: { ui: tool.ui } }, run);
      continue;
    }

    server.registerTool(tool.name, config, run);
  }

  return server;
};
