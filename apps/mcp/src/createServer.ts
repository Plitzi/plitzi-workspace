import { createHttpServer, makeHandler } from '@plitzi/sdk-server/kernel';

import { buildMCPPipeline } from './pipeline';

import type { BaseContext, BuildContext } from '@plitzi/sdk-server/kernel';
import type { PluginRegistry, SSRServer, SSRServerConfig } from '@plitzi/sdk-shared';

// MCP servers host no plugins and no HTML cache; an inert registry keeps the SSRServer shape uniform.
const noPlugins: PluginRegistry = {
  register: () => undefined,
  invalidate: () => Promise.resolve()
};

/** The server this package makes: the lean mcp-ai pipeline over the bare context — no render template, caches
 *  or plugin manager. Pair it with the MCP adapters (getGrant + getSchema/getStyle/saveSchema/saveStyle).
 *
 *  It owns its whole sub-domain, answering JSON-RPC on every path rather than under /mcp. To serve MCP alongside
 *  pages on one port instead, hand `mcpExtensions()` to createServer from `@plitzi/sdk-server`. */
export const createServer = (config: SSRServerConfig): SSRServer => {
  const stages = buildMCPPipeline();
  const makeHandlerForPort = (port: number) => {
    const buildContext: BuildContext<BaseContext> = (raw, rawRes, req, res) => ({
      raw,
      rawRes,
      req,
      res,
      config,
      port
    });

    return makeHandler('MCP', buildContext, stages, config.compression);
  };

  return createHttpServer(config, makeHandlerForPort, { label: 'MCP', cache: null, plugins: noPlugins });
};
