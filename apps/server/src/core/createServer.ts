import { connectorRscData } from '../modules/rsc/connectorRscData';
import { createAuthApiStage } from './http/stages/authApi';
import { createPageServer } from './server/pageServer';
import { resolveServices } from './services/resolve';

import type { Auth } from './auth/createAuth';
import type { PipelineExtensions } from './http/types';
import type { ConnectorLookups } from '../modules/connectors/resolver';
import type { SSRPageAdapters, SSRPageServerConfig, SSRServer, SSRServerConfig } from '@plitzi/sdk-shared';

export { resolveServices } from './services/resolve';
export type { PipelineExtensions } from './http/types';
export type { ResolvedServices } from './services/resolve';

export type ServerConfig = Omit<SSRServerConfig, 'adapters'> & {
  /** A page server resolves and renders a space on every request, so the two adapters that do it are required
   *  here — see {@link SSRPageAdapters}. They are optional on the shared type because a server that renders no
   *  page (a dedicated MCP one) has nothing to answer them with. */
  adapters: SSRPageAdapters;
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
/**
 * Fills in `getRscData` from `connectors` when the deployment did not write one.
 *
 * The lookups are already here and the assembly is entirely this package's — `createConnectorResolver` over
 * `resolveRscData`. Leaving it out meant every deployment passed the same lookups twice: once as config, for the
 * write endpoint, and once folded by hand into an adapter, for the read.
 */
const withConnectorRsc = <T extends { adapters: SSRPageAdapters; connectors?: unknown }>(config: T): T => {
  if (config.adapters.getRscData || !config.connectors) {
    return config;
  }

  return {
    ...config,
    adapters: { ...config.adapters, getRscData: connectorRscData(config.connectors as ConnectorLookups) }
  };
};

export const createServer = ({ auth, ...config }: ServerConfig, extensions?: PipelineExtensions): SSRServer => {
  if (!auth) {
    const resolvedConfig = withConnectorRsc(config);

    return createPageServer(resolvedConfig, resolveServices(resolvedConfig), extensions);
  }

  // Only what the deployment actually supplied overrides auth's answers. A plain spread would let a `getUser: undefined`
  // — which is what an adapter factory emits for a capability it does not provide — silently unwire the session, and
  // the page would render every visitor as a guest while `/auth/session` insisted they were signed in.
  // Read as `unknown` on purpose: the type says an optional adapter is either present or absent, while an object can
  // perfectly well carry the key with `undefined` in it — which is exactly the case being filtered out.
  // The cast is what TS cannot derive: dropping only the `undefined` values leaves the two adapters a page server
  // requires exactly where they were, since neither can have been undefined to begin with.
  const entries = Object.entries(config.adapters) as [string, unknown][];
  const supplied = Object.fromEntries(entries.filter(([, value]) => value !== undefined)) as SSRPageAdapters;

  // The adapter-only login/logout stages answer on these same paths and run first, and all they can say about a
  // successful sign-in is a bodyless 200 — they hold a session, not the account behind it. Left standing they
  // shadow the flows below, so a client that signed in correctly got nothing back to prove it. A deployment that
  // named its own paths keeps them: it asked for those endpoints, and they are then somewhere else entirely.
  const resolved: SSRPageServerConfig = withConnectorRsc({
    loginPath: false,
    logoutPath: false,
    exchangePath: false,
    ...config,
    authCookie: config.authCookie ?? auth.cookieConfig,
    adapters: { ...auth.ssrAdapters, ...supplied }
  });

  // `preAuth`, because these gate themselves: each flow already states what a caller must present, and half of
  // them are what a signed-out visitor uses to sign in.
  const withAuthRoutes: PipelineExtensions = {
    ...extensions,
    preAuth: [...(extensions?.preAuth ?? []), createAuthApiStage(auth, auth.basePath)]
  };

  return createPageServer(resolved, resolveServices(resolved), withAuthRoutes);
};
