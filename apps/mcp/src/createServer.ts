import { createHttpServer, makeHandler } from '@plitzi/sdk-kernel/http';

import { buildMCPPipeline } from './pipeline';

import type { McpOptions } from './options';
import type { BaseContext, BuildContext, HttpServer } from '@plitzi/sdk-kernel/http';
import type { SSRServerConfig } from '@plitzi/sdk-server';

/** The server this package makes: the lean MCP pipeline over the bare context — no render template, caches
 *  or plugin manager. `config` is the HTTP server's (port, TLS, health, logger, adapters); `options` is what MCP
 *  itself serves, and lives here rather than in that config because the server does not need to know. Pair it with
 *  the MCP adapters (getGrant + getSchema/getStyle/saveSchema/saveStyle) — the page adapters are not required, and
 *  a dedicated MCP server has nothing to answer them with.
 *
 *  It owns its whole sub-domain, answering JSON-RPC on every path rather than under /mcp. To serve MCP alongside
 *  pages on one port instead, hand `mcpExtensions(options)` to createServer from `@plitzi/sdk-server`. */
export const createServer = (config: SSRServerConfig, options: McpOptions = {}): HttpServer => {
  const stages = buildMCPPipeline(options);
  const makeHandlerForPort = (port: number) => {
    const buildContext: BuildContext<BaseContext> = (raw, rawRes, req, res) => ({
      raw,
      rawRes,
      req,
      res,
      config,
      port
    });

    return makeHandler('MCP', buildContext, stages, { compression: config.compression });
  };

  return createHttpServer(config, makeHandlerForPort, { label: 'MCP' });
};
