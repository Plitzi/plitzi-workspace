import { createMCPServer } from './server/mcpServer';
import { createSSRServer } from './server/ssrServer';
import { resolveServices } from './services/resolve';

import type { SSRServer, SSRServerConfig } from '@plitzi/sdk-shared';

export { createSSRServer } from './server/ssrServer';
export { createMCPServer } from './server/mcpServer';
export { resolveServices } from './services/resolve';
export type { ResolvedServices } from './services/resolve';

// Entry wrapper: routes a config to the specialized factory for the surface it asks for. An MCP-only config
// gets the lean MCP server; anything with a page/RSC surface gets the full SSR server. Callers that already
// know which they want can import createSSRServer / createMCPServer directly.
export const createServer = (config: SSRServerConfig): SSRServer => {
  const services = resolveServices(config);
  if (services.mcp && !services.ssr && !services.rsc && !services.ai) {
    return createMCPServer(config);
  }

  return createSSRServer(config);
};
