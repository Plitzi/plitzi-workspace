import { connectionId } from './sign';
import { DEFAULT_PROXY_TOOLS } from './types';
import { requestOrigin } from '../../../core/requestParser';

import type { ResourceProxy, ResourceProxySettings } from './types';
import type { SSRRequest, SSRServerConfig } from '@plitzi/sdk-shared';

export const PROXY_PATH = '/__proxy';

const MAX_BYTES = 8 * 1024 * 1024;
const TTL_SECONDS = 60 * 60 * 24 * 7;

/** What this deployment serves at its widget endpoint, or undefined when it serves none. A secret is what turns it
 *  on: without one the endpoint could not tell its own widgets' URLs from anyone else's, and an unsigned fetcher
 *  on a public origin is an open proxy. */
export const proxySettings = (config: SSRServerConfig): ResourceProxySettings | undefined => {
  const proxy = config.mcpAi?.proxy;
  if (!proxy?.secret || proxy.enabled === false) {
    return undefined;
  }

  return {
    path: proxy.path ?? PROXY_PATH,
    secret: proxy.secret,
    maxBytes: proxy.maxBytes ?? MAX_BYTES,
    ttl: proxy.ttl ?? TTL_SECONDS,
    tools: proxy.tools ?? DEFAULT_PROXY_TOOLS,
    baseUrl: proxy.baseUrl
  };
};

/** The endpoint as a widget must address it: absolute, because the page runs on the host's origin and a relative
 *  URL there points at the host. Falls back to the origin this request came in on, which is the right one whenever
 *  the MCP server owns its sub-domain; a deployment reached under a different public name sets `proxy.baseUrl`. */
const endpointOf = (settings: ResourceProxySettings, req: SSRRequest): string | undefined => {
  const base = (settings.baseUrl ?? requestOrigin(req)).replace(/\/$/, '');

  return base ? `${base}${settings.path}` : undefined;
};

/** The proxy a tool rewrites through. The grants it mints carry the fingerprint of THIS request's credential, so
 *  they belong to this connection. */
export const requestProxy = (config: SSRServerConfig, req: SSRRequest): ResourceProxy | undefined => {
  const settings = proxySettings(config);
  const endpoint = settings && endpointOf(settings, req);
  if (!settings || !endpoint) {
    return undefined;
  }

  return {
    endpoint,
    secret: settings.secret,
    identity: connectionId(req.headers.authorization, settings.secret),
    ttl: settings.ttl,
    tools: settings.tools
  };
};

/** The proxy the ENDPOINT itself mints with, while serving an API answer that carries URLs of its own. The request
 *  it is serving comes from a sandboxed iframe and presents no credential, so the connection is the one signed into
 *  the grant being served — the widget's own — rather than one read off a header. */
export const grantingProxy = (
  settings: ResourceProxySettings,
  req: SSRRequest,
  identity: string
): ResourceProxy | undefined => {
  const endpoint = endpointOf(settings, req);

  return endpoint
    ? { endpoint, secret: settings.secret, identity, ttl: settings.ttl, tools: settings.tools }
    : undefined;
};

/** The proxy THIS tool may use, or undefined — the single place that decides it, so a tool cannot reach the
 *  endpoint by being wired to it later. A render authors a throwaway widget, so rewriting its URLs is invisible
 *  and lasts as long as the widget does; a tool that WRITES a space (plitzi_apply) would persist those URLs into
 *  content the user owns, which is why it is not on the list unless a deployment puts it there deliberately. */
export const proxyForTool = (proxy: ResourceProxy | undefined, tool: string): ResourceProxy | undefined =>
  proxy?.tools.includes(tool) ? proxy : undefined;
