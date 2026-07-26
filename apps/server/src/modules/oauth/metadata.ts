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

/** RFC 9728. The document Claude Desktop asks for FIRST, and the one whose absence ends the flow before anything
 *  else is tried — a 404 here is what a host reports as `mcp_auth_start_failed`. */
export const protectedResourceMetadata = (config: OAuthConfig, req: SSRRequest): Record<string, unknown> => {
  const issuer = issuerOf(config, req);

  return {
    resource: issuer,
    authorization_servers: [issuer],
    scopes_supported: scopesOf(config),
    bearer_methods_supported: ['header']
  };
};

/** RFC 8414. Public clients with PKCE only: a desktop host stores no secret, so `none` is the sole endpoint auth
 *  method and S256 the sole challenge method. */
export const authorizationServerMetadata = (config: OAuthConfig, req: SSRRequest): Record<string, unknown> => {
  const issuer = issuerOf(config, req);
  const grantTypes = config.refreshTtlSeconds === 0 ? ['authorization_code'] : ['authorization_code', 'refresh_token'];

  return {
    issuer,
    authorization_endpoint: `${issuer}${AUTHORIZE_PATH}`,
    token_endpoint: `${issuer}${TOKEN_PATH}`,
    registration_endpoint: `${issuer}${REGISTER_PATH}`,
    response_types_supported: ['code'],
    grant_types_supported: grantTypes,
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: scopesOf(config)
  };
};
