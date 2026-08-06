import { createPageServer } from './server/pageServer';
import { resolveServices } from './services/resolve';

import type { PipelineExtensions } from './http/types';
import type { SSRServer, SSRServerConfig } from '@plitzi/sdk-shared';

export { createSSRServer } from './server/pageServer';
export { resolveServices } from './services/resolve';
export type { PipelineExtensions } from './http/types';
export type { ResolvedServices } from './services/resolve';

/** The general server: mounts whatever the config asks for — SSR and RSC together, if that is what it enables —
 *  plus any stages a companion package contributes through `extensions`. The MCP endpoint, the widget proxy and
 *  draft-preview arrive that way from `@plitzi/sdk-mcp`, which a page-only deployment never installs.
 *
 *  Prefer the surface-specific factory whenever the surface IS known, so the process states what it serves by the
 *  name it calls: createSSRServer for pages + RSC. A dedicated MCP server is `createMCPServer` from
 *  `@plitzi/sdk-mcp` — it builds none of the render template, caches or plugin manager this one would. */
export const createServer = (config: SSRServerConfig, extensions?: PipelineExtensions): SSRServer =>
  createPageServer(config, resolveServices(config), extensions);
