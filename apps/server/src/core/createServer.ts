import { createMCPServer } from './server/mcpServer';
import { createPageServer } from './server/pageServer';
import { resolveServices } from './services/resolve';

import type { SSRServer, SSRServerConfig } from '@plitzi/sdk-shared';

export { createSSRServer } from './server/pageServer';
export { createMCPServer } from './server/mcpServer';
export { resolveServices } from './services/resolve';
export type { ResolvedServices } from './services/resolve';

/** The general server: mounts whatever the config asks for — SSR, RSC and MCP together, if that is what it
 *  enables — and is what a deployment reaches for when it serves more than one surface from a single port (the
 *  package's own standalone harness does exactly that).
 *
 *  Prefer the surface-specific factories whenever the surface IS known, so the process states what it serves by
 *  the name it calls: createSSRServer for pages + RSC, createMCPServer for a dedicated MCP server. An MCP-only
 *  config is handed to the latter here, since the lean pipeline builds none of the render template, caches or
 *  plugin manager a page server would carry unused. */
export const createServer = (config: SSRServerConfig): SSRServer => {
  const services = resolveServices(config);
  if (services.mcp && !services.ssr && !services.rsc && !services.ai) {
    return createMCPServer(config);
  }

  return createPageServer(config, services);
};
