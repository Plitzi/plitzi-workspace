import { writeSessionCookies } from '../../auth/session';
import { readRawBody } from '../../requestParser';

import type { Stage } from '../types';
import type { SSRRequest } from '@plitzi/sdk-shared';

const parseBody = (req: SSRRequest): { provider?: string; token?: string } => {
  if (!req.body) {
    return {};
  }

  try {
    const parsed = JSON.parse(req.body) as { provider?: unknown; token?: unknown };

    return {
      provider: typeof parsed.provider === 'string' ? parsed.provider : undefined,
      token: typeof parsed.token === 'string' ? parsed.token : undefined
    };
  } catch {
    return {};
  }
};

/**
 * Turns a credential the browser obtained on its own into a session of this server's, through the
 * `exchangeCredential` adapter. A deployment running the auth kernel gets `POST /auth/exchange` from the flows
 * instead, and `createServer` stands this one down so the two never answer on the same path.
 *
 * It exists for identity providers that live in the front-end — Auth0 and the like — where this server never sees
 * the sign-in and would go on rendering every page as a guest while the browser knows perfectly well who the
 * visitor is. The page then changes under them as it hydrates. Handing the credential over closes that gap.
 *
 * Everything that decides whether the credential is any good is the adapter's: which providers this deployment
 * trusts, whether the token was minted for *this* application, and who it belongs to. This layer contributes the
 * part that is the same everywhere — reading the request, and writing the session it gets back.
 */
export const exchangeStage: Stage = async ctx => {
  const { config, raw, req, res } = ctx;
  const exchangePath = config.exchangePath === false ? null : (config.exchangePath ?? '/auth/exchange');
  if (!exchangePath || req.method !== 'POST' || req.path !== exchangePath) {
    return false;
  }

  if (!config.adapters.exchangeCredential) {
    res.setStatus(404);
    res.end();

    return true;
  }

  req.body = await readRawBody(raw);
  const { provider, token } = parseBody(req);

  if (!provider || !token) {
    res.setStatus(400);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ error: 'A provider and a token are required' }));

    return true;
  }

  const result = await config.adapters.exchangeCredential(provider, token, req);

  if (!result.ok) {
    res.setStatus(result.status ?? 401);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ error: result.error, reason: result.reason ?? 'revoked' }));

    return true;
  }

  writeSessionCookies(req, res, result.session, config.authCookie);
  res.setStatus(200);
  res.setHeader('Content-Type', 'application/json');
  // The same body a grant answers with, so a client treats it as one: it knows who it is without a follow-up call.
  res.send(JSON.stringify({ success: true, details: result.user, access_token: result.session.token }));

  return true;
};
