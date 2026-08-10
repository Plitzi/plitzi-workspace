import { createAuthApiStage } from './http/stages/authApi';
import { createPageServer } from './server/pageServer';
import { resolveServices } from './services/resolve';

import type { Auth } from './auth/createAuth';
import type { PipelineExtensions } from './http/types';
import type { SSRServer, SSRServerConfig } from '@plitzi/sdk-shared';

export { resolveServices } from './services/resolve';
export type { PipelineExtensions } from './http/types';
export type { ResolvedServices } from './services/resolve';

export type ServerConfig = Omit<SSRServerConfig, 'adapters'> & {
  adapters: SSRServerConfig['adapters'];
  /**
   * A `createAuth(...)` result, and the whole of wiring sessions into a page server: the three adapters it answers
   * for get filled in, and the cookie naming comes with them.
   *
   * That last part is the reason this takes the object rather than leaving a deployment to spread `ssrAdapters`
   * itself. The naming would then be declared twice — here and in `createAuth` — and the two halves would write and
   * read a session under different names the first time one of them was edited alone. Anything set explicitly on
   * `adapters` or `authCookie` still wins, so a deployment can override one piece without giving up the rest.
   */
  auth?: Auth;
};

/** The server this package makes: pages and RSC, mounting whatever the config enables, plus any stages a
 *  companion package contributes through `extensions`. The MCP endpoint, the widget proxy and draft-preview
 *  arrive that way from `@plitzi/sdk-mcp`, which a page-only deployment never installs.
 *
 *  A dedicated MCP server is `createServer` from `@plitzi/sdk-mcp` — it builds none of the render template,
 *  caches or plugin manager this one does. */
export const createServer = ({ auth, ...config }: ServerConfig, extensions?: PipelineExtensions): SSRServer => {
  if (!auth) {
    return createPageServer(config, resolveServices(config), extensions);
  }

  const resolved: SSRServerConfig = {
    ...config,
    authCookie: config.authCookie ?? auth.cookieConfig,
    adapters: { ...auth.ssrAdapters, ...config.adapters }
  };

  // `preAuth`, because these gate themselves: each flow already states what a caller must present, and half of
  // them are what a signed-out visitor uses to sign in.
  const withAuthRoutes: PipelineExtensions = {
    ...extensions,
    preAuth: [...(extensions?.preAuth ?? []), createAuthApiStage(auth)]
  };

  return createPageServer(resolved, resolveServices(resolved), withAuthRoutes);
};
