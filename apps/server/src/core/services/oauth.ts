import { handleAuthorizeStart, handleAuthorizeSubmit } from '../../modules/oauth/authorize';
import {
  authorizationServerMetadata,
  AUTHORIZATION_SERVER_PATH,
  AUTHORIZE_PATH,
  protectedResourceMetadata,
  PROTECTED_RESOURCE_PATH,
  REGISTER_PATH,
  TOKEN_PATH
} from '../../modules/oauth/metadata';
import { handleRegister } from '../../modules/oauth/register';
import { sendErrorJson, sendJson } from '../../modules/oauth/respond';
import { handleToken } from '../../modules/oauth/token';
import { readRawBody } from '../requestParser';

import type { OAuthParams } from '../../modules/oauth/params';
import type { Stage } from '../http/types';
import type { SSRRequest } from '@plitzi/sdk-shared';

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
