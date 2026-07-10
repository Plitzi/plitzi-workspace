import { handleMcp } from '../../modules/mcp/handler';

import type { Stage } from '../http/types';
import type { ServerResponse } from 'node:http';

const mcpPathOf = (path: string | undefined): string => path ?? '/mcp';

const serveMcp = (ctx: Parameters<Stage>[0]): Promise<void> =>
  handleMcp(ctx.raw, ctx.rawRes as unknown as ServerResponse, ctx.req, ctx.config.adapters);

// AI-native MCP (mcp-ai) mounted alongside other services: only answers under its path, so page/RSC routes
// fall through. Stateless — resolves its own spaceId from the request token via the adapters.
export const mcpStage: Stage = async ctx => {
  if (!ctx.req.path.startsWith(mcpPathOf(ctx.config.mcp?.path))) {
    return false;
  }

  await serveMcp(ctx);

  return true;
};

// The whole-server variant for a dedicated MCP server: every request (after health) is MCP, so there is no
// path filter — the server is reached at its own sub-domain root.
export const mcpOnlyStage: Stage = async ctx => {
  await serveMcp(ctx);

  return true;
};

// Legacy tool-calling MCP server, kept for consumers still on the old protocol. Its handler drags in a heavy
// dependency tree (plitzi-ui markdown), so it loads lazily — only when a legacy request actually arrives —
// keeping it out of every server's startup graph.
export const mcpLegacyStage: Stage = async ctx => {
  if (!ctx.config.mcp || !ctx.req.path.startsWith(mcpPathOf(ctx.config.mcp.path))) {
    return false;
  }

  const { handleMcp: handleMcpLegacy } = await import('../../modules/mcp-legacy/handler');
  await handleMcpLegacy(ctx.raw, ctx.rawRes as unknown as ServerResponse, ctx.config.mcp);

  return true;
};
