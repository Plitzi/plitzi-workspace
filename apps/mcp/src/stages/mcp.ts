import { handleMcp } from '../modules/mcp/handler';
import { createHttpPreviewClient } from '../modules/mcp/previewClient';
import { requestProxy } from '../modules/mcp/proxy';
import { createHttpScreenshotClient } from '../modules/mcp/screenshotClient';

import type { McpOptions } from '../options';
import type { Stage } from '@plitzi/sdk-server/kernel';
import type { ServerResponse } from 'node:http';

// Where MCP answers inside a page server. Defaulting to '/' would make this stage swallow every route (it runs
// before SSR), so the documented default stands.
const DEFAULT_PATH = '/mcp';

// Records the JSON-RPC method it served on the context: every call shares one URL, so without it the access log
// could only ever say `POST /`.
const serveMcp = async (ctx: Parameters<Stage>[0], options: McpOptions): Promise<void> => {
  const { previewClient, screenshot } = options;

  ctx.operation = await handleMcp(ctx.raw, ctx.rawRes as unknown as ServerResponse, ctx.req, ctx.config.adapters, {
    preview: previewClient ? createHttpPreviewClient(previewClient) : undefined,
    screenshot: screenshot ? createHttpScreenshotClient(screenshot) : undefined,
    logger: ctx.config.logger,
    renderStreaming: options.renderStreaming,
    proxy: requestProxy(options.proxy, ctx.req)
  });
};

// AI-native MCP (mcp-ai) mounted alongside other services: only answers under its path, so page/RSC routes
// fall through. Stateless — resolves its own spaceId from the request token via the adapters.
export const createMcpStage = (options: McpOptions = {}): Stage => {
  const path = options.path ?? DEFAULT_PATH;

  return async ctx => {
    if (!ctx.req.path.startsWith(path)) {
      return false;
    }

    await serveMcp(ctx, options);

    return true;
  };
};

// The whole-server variant for a dedicated MCP server: every request (after health) is MCP, so there is no
// path filter — the server is reached at its own sub-domain root.
export const createMcpOnlyStage =
  (options: McpOptions = {}): Stage =>
  async ctx => {
    await serveMcp(ctx, options);

    return true;
  };
