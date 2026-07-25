import { handleMcp } from '../../modules/mcp/handler';
import { createHttpPreviewClient } from '../../modules/mcp/previewClient';
import { createHttpScreenshotClient } from '../../modules/mcp/screenshotClient';

import type { Stage } from '../http/types';
import type { SSRServerConfig } from '@plitzi/sdk-shared';
import type { ServerResponse } from 'node:http';

// Where MCP answers inside a page server. Defaulting to '/' would make this stage swallow every route (it runs
// before SSR), so the documented default stands: /mcp, with mcpAi's own path winning when set.
const mcpPathOf = (config: SSRServerConfig): string => config.mcpAi?.path ?? config.mcp?.path ?? '/mcp';

const serveMcp = (ctx: Parameters<Stage>[0]): Promise<void> => {
  const { previewClient, screenshot, adapters, mcpLogger } = ctx.config;

  return handleMcp(ctx.raw, ctx.rawRes as unknown as ServerResponse, ctx.req, adapters, {
    preview: previewClient ? createHttpPreviewClient(previewClient) : undefined,
    screenshot: screenshot ? createHttpScreenshotClient(screenshot) : undefined,
    logger: mcpLogger
  });
};

// AI-native MCP (mcp-ai) mounted alongside other services: only answers under its path, so page/RSC routes
// fall through. Stateless — resolves its own spaceId from the request token via the adapters.
export const mcpStage: Stage = async ctx => {
  if (!ctx.req.path.startsWith(mcpPathOf(ctx.config))) {
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
