import { handleAuthorizeStart, handleAuthorizeSubmit } from '../../modules/oauth/authorize';
import { bearerOf, sendChallenge } from '../../modules/oauth/challenge';
import {
  authorizationServerMetadata,
  AUTHORIZATION_SERVER_PATH,
  AUTHORIZE_PATH,
  protectedResourceMetadata,
  PROTECTED_RESOURCE_PATH,
  REGISTER_PATH,
  TOKEN_PATH
} from '../../modules/oauth/metadata';
import { getAccess } from '../../modules/oauth/records';
import { handleRegister } from '../../modules/oauth/register';
import { sendErrorJson, sendJson } from '../../modules/oauth/respond';
import { handleToken } from '../../modules/oauth/token';
import { readRawBody } from '../requestParser';

import type { OAuthParams } from '../../modules/oauth/params';
import type { BaseContext, Stage } from '../http/types';
import type { OAuthConfig, SSRRequest } from '@plitzi/sdk-shared';

// RFC 9728 allows the resource's path to be appended to the well-known path, so a client may ask for either
// `/.well-known/oauth-protected-resource` or `/.well-known/oauth-protected-resource/<path>`.
const matchesWellKnown = (path: string, wellKnown: string): boolean =>
  path === wellKnown || path.startsWith(`${wellKnown}/`);

const isOAuthPath = (path: string): boolean =>
  matchesWellKnown(path, PROTECTED_RESOURCE_PATH) ||
  matchesWellKnown(path, AUTHORIZATION_SERVER_PATH) ||
  path === REGISTER_PATH ||
  path === AUTHORIZE_PATH ||
  path === TOKEN_PATH;

// Query first, body second: a field posted by the form wins over one the client left in the URL.
const formParams = (req: SSRRequest, body: string): OAuthParams => {
  const params: OAuthParams = { ...req.query };
  for (const [key, value] of new URLSearchParams(body).entries()) {
    params[key] = value;
  }

  return params;
};

const parseJson = (body: string): unknown => {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
};

/** OAuth 2.1 authorization for the MCP server, mounted ONLY when a deployment configures `oauth`. Without it the
 *  stage falls straight through and the server keeps its anonymous contract: discovery 404s, the public surface
 *  (handshake, listings, the guide, plitzi_render) answers without a token, and nothing below changes.
 *
 *  It sits before the MCP stage because that one answers every path on a dedicated MCP server — these endpoints
 *  would otherwise be swallowed by the JSON-RPC transport, which is exactly the 406 a host hits on /register. */
export const oauthStage: Stage = async ctx => {
  const { oauth } = ctx.config;
  const { path, method } = ctx.req;
  if (!oauth || !isOAuthPath(path)) {
    return false;
  }

  const { res } = ctx;
  // The consent screen is a top-level navigation, never a cross-origin fetch; the machine endpoints are both.
  if (path !== AUTHORIZE_PATH) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }

  if (method === 'OPTIONS') {
    res.setStatus(204);
    res.end();

    return true;
  }

  if (method === 'GET' && matchesWellKnown(path, PROTECTED_RESOURCE_PATH)) {
    sendJson(res, 200, protectedResourceMetadata(oauth, ctx.req));

    return true;
  }

  if (method === 'GET' && matchesWellKnown(path, AUTHORIZATION_SERVER_PATH)) {
    sendJson(res, 200, authorizationServerMetadata(oauth, ctx.req));

    return true;
  }

  if (path === AUTHORIZE_PATH && method === 'GET') {
    await handleAuthorizeStart(oauth, res, ctx.req.query);

    return true;
  }

  if (path === AUTHORIZE_PATH && method === 'POST') {
    await handleAuthorizeSubmit(oauth, res, formParams(ctx.req, await readRawBody(ctx.raw)));

    return true;
  }

  if (path === TOKEN_PATH && method === 'POST') {
    await handleToken(oauth, res, formParams(ctx.req, await readRawBody(ctx.raw)));

    return true;
  }

  if (path === REGISTER_PATH && method === 'POST') {
    await handleRegister(oauth, res, parseJson(await readRawBody(ctx.raw)));

    return true;
  }

  sendErrorJson(res, 405, 'invalid_request', `${method} is not allowed on ${path}.`);

  return true;
};

/** Fail-closed on purpose: a credential this server cannot check right now — an unreachable store, an adapter that
 *  threw — is not one it may act on, and 401 is the answer a host can do something about (re-authorize) where a
 *  500 leaves it stuck. */
const verified = async <T>(check: () => Promise<T>): Promise<T | undefined> => {
  try {
    return await check();
  } catch {
    return undefined;
  }
};

// Two ways a bearer is legitimate: this server minted it through the grant, which the access record proves, or it
// is a space token the platform issued elsewhere (the builder and the CLI send those) — the resource adapters own
// the secret those are signed with, so they are what can vouch for them.
const isAuthorized = async (oauth: OAuthConfig, ctx: BaseContext, token: string): Promise<boolean> => {
  const record = await verified(() => getAccess(oauth.adapters.store, token));
  if (record) {
    // The bearer the host holds is this server's handle for the grant; what everything downstream expects is the
    // credential the consumer issued. Swapped onto the request here — the one place that knows the mapping — so
    // `adapters.getSpaceId` keeps reading a request exactly as it always has, whoever the caller is. A record from
    // before the split carries no credential because the bearer was one (see AccessRecord).
    const credential = record.credential ?? token;
    ctx.req.headers['x-access-token'] = credential;
    ctx.req.headers.authorization = `Bearer ${credential}`;

    return true;
  }

  const { adapters } = ctx.config;

  return (await verified(() => adapters.getSpaceId?.(ctx.req) ?? Promise.resolve(undefined))) !== undefined;
};

/** The protected-resource half of OAuth: an MCP call that presents no bearer this server can verify is refused
 *  with RFC 6750's challenge instead of being served the anonymous surface. That 401 is the whole handshake — it
 *  is how a host learns the server needs authorization, where its metadata lives and which scopes to ask for, and
 *  a 200 tells it none of that. Only the JSON-RPC POST is guarded: the CORS preflight, the GET 405 and the
 *  discovery probes carry no credential and must keep answering as they do.
 *
 *  Mounted only when `oauth` is configured. A deployment that configures none keeps the open server it had, where
 *  the whole public surface — handshake, listings, the guide, plitzi_render — answers without a token; with OAuth
 *  on, the grant that carries no space is what covers that same ground. */
export const oauthGuardStage: Stage = async ctx => {
  const { oauth } = ctx.config;
  if (!oauth || ctx.req.method !== 'POST') {
    return false;
  }

  const token = bearerOf(ctx.req);
  if (token && (await isAuthorized(oauth, ctx, token))) {
    return false;
  }

  sendChallenge(
    oauth,
    ctx.req,
    ctx.res,
    token ? 'The access token is invalid, expired or revoked.' : 'Authorization is required to use this server.'
  );

  return true;
};
