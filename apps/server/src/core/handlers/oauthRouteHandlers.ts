import { handleAuthorizeStart, handleAuthorizeSubmit } from '../oauth/authorize';
import { authorizationServerMetadata, protectedResourceMetadata } from '../oauth/metadata';
import { handleRegister } from '../oauth/register';
import { sendErrorJson } from '../oauth/respond';
import { handleRevoke, handleToken } from '../oauth/token';

import type { AuthedRequest, HttpRoute, RouterLike } from './types';
import type { OAuthParams } from '../oauth/params';
import type { OAuthConfig, SSRRequest, SSRResponseHelpers } from '@plitzi/sdk-shared';

/**
 * A response that can send bytes, which OAuth needs and `JsonResponse` does not offer.
 *
 * The grant screen is HTML and the code hand-off is a 302, so this asks for the two things a JSON-only response
 * cannot do. Express satisfies it as it stands; anything else needs a `send`, a `setHeader` and a status.
 */
export interface OAuthResponse {
  status: (code: number) => OAuthResponse;
  setHeader: (name: string, value: string | string[]) => unknown;
  send: (body: string) => unknown;
  end: () => unknown;
}

export type OAuthRouteHandler = (req: AuthedRequest, res: OAuthResponse) => Promise<void>;

export interface OAuthRouteHandlersOptions {
  config: OAuthConfig;
  onError?: (error: unknown, route: { method: string; path: string }) => void;
}

/**
 * The host's response, described the way the protocol handlers expect it.
 *
 * They were written against the render pipeline's helpers, which is a different shape from a router's response
 * and deliberately so: one collects a status and headers to be applied later, the other writes as it goes. This
 * is the whole of the difference, in one place, so neither side learns about the other.
 */
const asHelpers = (res: OAuthResponse): SSRResponseHelpers => {
  const helpers: SSRResponseHelpers = {
    status: 200,
    headers: {},
    setHeader: (name, value) => {
      helpers.headers[name] = value;
      res.setHeader(name, value);
    },
    setStatus: code => {
      helpers.status = code;
      res.status(code);
    },
    send: body => {
      res.send(typeof body === 'string' ? body : body.toString('utf8'));
    },
    write: chunk => {
      res.send(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
    },
    end: () => {
      res.end();
    }
  };

  return helpers;
};

/**
 * The request, as the protocol reads it.
 *
 * `protocol` earns its place: the issuer published in the discovery documents is built from it, and a request
 * that omits it publishes `undefined://api.example.com` — a document every client rejects. Behind a proxy the
 * forwarded header is the only thing that knows, since the hop to this process is plain HTTP.
 */
const asRequest = (req: AuthedRequest): SSRRequest => {
  const forwarded = req.headers['x-forwarded-proto'];
  const protocol = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0] ?? req.protocol ?? 'https';

  return {
    method: req.method ?? 'GET',
    path: req.path,
    headers: req.headers,
    hostname: req.hostname,
    protocol: protocol === 'http' ? 'http' : 'https',
    query: (req.query ?? {}) as Record<string, string>
  } as SSRRequest;
};

/** Query first, body second: a field posted by the grant form wins over one the client left in the URL. */
const params = (req: AuthedRequest): OAuthParams => ({
  ...((req.query ?? {}) as OAuthParams),
  ...((req.body ?? {}) as OAuthParams)
});

/**
 * OAuth 2.1 authorization as ordinary routes, for a host that runs a router rather than the render pipeline.
 *
 * The same handlers the pipeline stage calls — this is the mounting, not a second implementation. A deployment
 * whose API is an Express app mounts these; one whose MCP server is the SDK's own pipeline mounts the stage. Both
 * grant the credential `config.adapters.issueToken` mints, and THAT is what distinguishes one mounting from
 * another: a space-scoped agent token for a connector, a user session for a native client.
 *
 * `paths` are relative, so the host decides where the set answers. The discovery documents must be reachable at
 * the well-known paths off the ORIGIN root, so a host that mounts this under a prefix serves those two itself.
 */
export const createOAuthRouteHandlers = ({
  config,
  onError
}: OAuthRouteHandlersOptions): HttpRoute<OAuthRouteHandler>[] => {
  const guarded =
    (method: string, path: string, run: (req: AuthedRequest, res: OAuthResponse) => Promise<void>): OAuthRouteHandler =>
    async (req, res) => {
      try {
        await run(req, res);
      } catch (error: unknown) {
        if (onError) {
          onError(error, { method, path });
        } else {
          console.error(`[oauth] ${method} ${path} failed:`, error);
        }

        sendErrorJson(asHelpers(res), 500, 'server_error', 'The authorization server failed to answer.');
      }
    };

  return [
    {
      method: 'GET',
      path: '/authorize',
      handle: guarded('GET', '/authorize', async (req, res) =>
        handleAuthorizeStart(config, asHelpers(res), params(req), asRequest(req))
      )
    },
    {
      method: 'POST',
      path: '/authorize',
      handle: guarded('POST', '/authorize', async (req, res) =>
        handleAuthorizeSubmit(config, asHelpers(res), params(req))
      )
    },
    {
      method: 'POST',
      path: '/token',
      handle: guarded('POST', '/token', async (req, res) => handleToken(config, asHelpers(res), params(req)))
    },
    {
      method: 'POST',
      path: '/revoke',
      handle: guarded('POST', '/revoke', async (req, res) => handleRevoke(config, asHelpers(res), params(req)))
    },
    {
      method: 'POST',
      path: '/register',
      handle: guarded('POST', '/register', async (req, res) => handleRegister(config, asHelpers(res), req.body))
    },
    {
      method: 'GET',
      path: '/.well-known/oauth-authorization-server',
      handle: guarded('GET', '/.well-known/oauth-authorization-server', (req, res) => {
        const helpers = asHelpers(res);
        helpers.setHeader('Content-Type', 'application/json');
        helpers.setStatus(200);
        helpers.send(JSON.stringify(authorizationServerMetadata(config, asRequest(req))));

        return Promise.resolve();
      })
    },
    {
      method: 'GET',
      path: '/.well-known/oauth-protected-resource',
      handle: guarded('GET', '/.well-known/oauth-protected-resource', (req, res) => {
        const helpers = asHelpers(res);
        helpers.setHeader('Content-Type', 'application/json');
        helpers.setStatus(200);
        helpers.send(JSON.stringify(protectedResourceMetadata(config, asRequest(req))));

        return Promise.resolve();
      })
    }
  ];
};

/**
 * Where the set answers, relative to wherever it is mounted.
 *
 * Exported so a host's auth policy can DERIVE which paths are public rather than restating them: every one of
 * these is reached without a session by definition — `/authorize` is what a signed-out person opens, `/token` is
 * authenticated by PKCE, and the discovery documents are what a client reads before it has anything at all. A
 * restated list is one that drifts, and drifting the wrong way here means an authorization server nobody can
 * start a flow against.
 */
export const OAUTH_ROUTE_PATHS: string[] = [
  '/authorize',
  '/token',
  '/revoke',
  '/register',
  '/.well-known/oauth-authorization-server',
  '/.well-known/oauth-protected-resource'
];

/** {@link createOAuthRouteHandlers}, hung on anything with `get` and `post`. */
export const mountOAuthRoutes = (router: RouterLike<OAuthRouteHandler>, options: OAuthRouteHandlersOptions): void => {
  for (const { method, path, handle } of createOAuthRouteHandlers(options)) {
    if (method === 'GET') {
      router.get(path, handle);
    } else {
      router.post(path, handle);
    }
  }
};
