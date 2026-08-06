import { createHttpServer, makeHandler } from '@plitzi/sdk-server/kernel';

import { buildMCPPipeline } from '../pipeline';

import type { BaseContext, BuildContext } from '@plitzi/sdk-server/kernel';
import type { PluginRegistry, SSRServer, SSRServerConfig } from '@plitzi/sdk-shared';

// MCP servers host no plugins and no HTML cache; an inert registry keeps the SSRServer shape uniform.
const noPlugins: PluginRegistry = {
  register: () => undefined,
  invalidate: () => Promise.resolve()
};

// MCP-only server: the lean mcp-ai pipeline over the bare context — no render template, caches or plugin
// manager. Pair it with the MCP adapters (getSpaceId + getSchema/getStyle/saveSchema/saveStyle).
export const createMCPServer = (config: SSRServerConfig): SSRServer => {
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

    return makeHandler('MCP', buildContext, stages);
  };

  return createHttpServer(config, makeHandlerForPort, { label: 'MCP', cache: null, plugins: noPlugins });
};
