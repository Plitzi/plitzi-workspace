import { handleMcp } from '../../modules/mcp/handler';
import { createHttpPreviewClient } from '../../modules/mcp/previewClient';
import { createHttpScreenshotClient } from '../../modules/mcp/screenshotClient';

import type { Stage } from '../http/types';
import type { ServerResponse } from 'node:http';

const mcpPathOf = (path: string | undefined): string => path ?? '/';

const serveMcp = (ctx: Parameters<Stage>[0]): Promise<void> => {
  const { previewClient, screenshot } = ctx.config;
  const preview = previewClient ? createHttpPreviewClient(previewClient) : undefined;
  const screenshotClient = screenshot ? createHttpScreenshotClient(screenshot) : undefined;

  return handleMcp(
    ctx.raw,
    ctx.rawRes as unknown as ServerResponse,
    ctx.req,
    ctx.config.adapters,
    preview,
    screenshotClient,
    ctx.config.logger
  );
};

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
