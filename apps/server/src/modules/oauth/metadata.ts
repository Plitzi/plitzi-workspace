import { requestOrigin } from '../../core/requestParser';

import type { OAuthConfig, SSRRequest } from '@plitzi/sdk-shared';

export const AUTHORIZE_PATH = '/authorize';
export const TOKEN_PATH = '/token';
export const REGISTER_PATH = '/register';
export const PROTECTED_RESOURCE_PATH = '/.well-known/oauth-protected-resource';
export const AUTHORIZATION_SERVER_PATH = '/.well-known/oauth-authorization-server';

const DEFAULT_SCOPES = ['plitzi'];

/** The identifier the two documents agree on. This server is both the protected resource and its own
 *  authorization server, so one origin names both. Derived from the request unless pinned, which keeps a
 *  deployment correct across its dev, staging and production hosts without per-environment config. */
export const issuerOf = (config: OAuthConfig, req: SSRRequest): string => config.issuer ?? requestOrigin(req);

export const scopesOf = (config: OAuthConfig): string[] => config.scopes ?? DEFAULT_SCOPES;

// A path as it belongs in a resource identifier: no trailing slash, and the root reduced to nothing — the
// canonical form a host compares against (`https://host`, never `https://host/`).
const canonicalPath = (path: string): string => path.replace(/\/+$/, '');

/** Where the challenge points a host, for an MCP endpoint served at `req.path`. RFC 9728 §3.1 appends the
 *  resource's own path to the well-known path, and a host that reads the document back expects its `resource` to
 *  name the URL it was configured with — so a server mounted at /mcp must be pointed at the suffixed document,
 *  not the bare one. */
export const resourceMetadataUrl = (config: OAuthConfig, req: SSRRequest): string =>
  `${issuerOf(config, req)}${PROTECTED_RESOURCE_PATH}${canonicalPath(req.path)}`;

/** RFC 9728. The document Claude Desktop asks for FIRST, and the one whose absence ends the flow before anything
 *  else is tried — a 404 here is what a host reports as `mcp_auth_start_failed`.
 *
 *  `resource` echoes the path the document was asked for: Claude requires it to match the server URL the user
 *  typed, path included, and a dedicated MCP server answers JSON-RPC on every path — so `/.well-known/…/mcp`
 *  describes `https://host/mcp` while the bare path describes the origin. */
export const protectedResourceMetadata = (config: OAuthConfig, req: SSRRequest): Record<string, unknown> => {
  const issuer = issuerOf(config, req);
  const suffix = canonicalPath(req.path.slice(PROTECTED_RESOURCE_PATH.length));

  return {
    resource: `${issuer}${suffix}`,
    authorization_servers: [issuer],
    scopes_supported: scopesOf(config),
    bearer_methods_supported: ['header']
  };
};

/** RFC 8414. Public clients with PKCE only: a desktop host stores no secret, so `none` is the sole endpoint auth
 *  method and S256 the sole challenge method. `offline_access` is advertised whenever refresh grants are issued,
 *  which is the signal a host looks for before asking for one. */
export const authorizationServerMetadata = (config: OAuthConfig, req: SSRRequest): Record<string, unknown> => {
  const issuer = issuerOf(config, req);
  const refreshes = config.refreshTtlSeconds !== 0;
  const grantTypes = refreshes ? ['authorization_code', 'refresh_token'] : ['authorization_code'];
  const scopes = refreshes ? [...scopesOf(config), 'offline_access'] : scopesOf(config);

  return {
    issuer,
    authorization_endpoint: `${issuer}${AUTHORIZE_PATH}`,
    token_endpoint: `${issuer}${TOKEN_PATH}`,
    registration_endpoint: `${issuer}${REGISTER_PATH}`,
    response_types_supported: ['code'],
    grant_types_supported: grantTypes,
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: scopes
  };
};
