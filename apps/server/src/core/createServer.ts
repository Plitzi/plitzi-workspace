import { createPageServer } from './server/pageServer';
import { resolveServices } from './services/resolve';

import type { PipelineExtensions } from './http/types';
import type { SSRServer, SSRServerConfig } from '@plitzi/sdk-shared';

export { resolveServices } from './services/resolve';
export type { PipelineExtensions } from './http/types';
export type { ResolvedServices } from './services/resolve';

/** The server this package makes: pages and RSC, mounting whatever the config enables, plus any stages a
 *  companion package contributes through `extensions`. The MCP endpoint, the widget proxy and draft-preview
 *  arrive that way from `@plitzi/sdk-mcp`, which a page-only deployment never installs.
 *
 *  A dedicated MCP server is `createServer` from `@plitzi/sdk-mcp` — it builds none of the render template,
 *  caches or plugin manager this one does. */
export const createServer = (config: SSRServerConfig, extensions?: PipelineExtensions): SSRServer =>
  createPageServer(config, resolveServices(config), extensions);
