import { refusedCrossSite } from './crossSiteWrites';
import { exchangeStage } from './exchangeRoute';
import { signInStage } from './signInRoute';
import { clearSessionCookies, writeSessionCookies } from '../../auth/session';
import { readRawBody } from '../../requestParser';
import { isNavigation, safeRedirectTarget } from '../navigation';

import type { Stage } from '../types';
import type { SessionScope, SSRRequest } from '@plitzi/sdk-shared';

/**
 * Credentials as they arrive from a page: a posted form, or JSON from a script. Every field is handed to the
 * adapter — a deployment may sign people in with something other than a username and a password, and this layer
 * has no opinion about which fields those are.
 */
const parseCredentials = (req: SSRRequest): Record<string, string> => {
  if (!req.body) {
    return {};
  }

  const contentType = req.headers['content-type'];
  if (typeof contentType === 'string' && contentType.includes('application/json')) {
    try {
      const parsed = JSON.parse(req.body) as Record<string, unknown>;

      return Object.fromEntries(
        Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      );
    } catch {
      return {};
    }
  }

  return Object.fromEntries(new URLSearchParams(req.body));
};

export const loginStage: Stage = async ctx => {
  const { config, raw, req, res } = ctx;
  const loginPath = config.loginPath === false ? null : (config.loginPath ?? '/auth/login');
  if (!loginPath || req.method !== 'POST' || req.path !== loginPath) {
    return false;
  }

  // Login CSRF: another site signing the visitor into an account it controls, so what they do next is recorded there.
  if (refusedCrossSite(ctx)) {
    return true;
  }

  req.body = await readRawBody(raw);

  // The adapter answers who this is; the cookies are this server's business. That split is what lets a deployment
  // bring its own user database without also reimplementing how a session travels.
  const session = await config.adapters.authenticate?.(parseCredentials(req), req);
  if (session) {
    writeSessionCookies(req, res, session, config.authCookie);
  }

  // A full-page form submission (navigation) must not be answered with a bodyless 401/200, or the browser
  // shows its own error page instead of the view. Redirect so the view re-renders via a GET.
  if (isNavigation(req)) {
    res.setStatus(303);
    res.setHeader('Location', session ? safeRedirectTarget(req) : loginPath);
    res.end();

    return true;
  }

  // A body, because a bodyless 200 leaves a caller unable to do anything with the session it just established —
  // and unable to tell this apart from an endpoint that answered nothing at all. Only what the adapter returned
  // is in it: this path knows a session, never the account behind it. That is `createAuth`, which answers the
  // whole grant here instead.
  res.setStatus(session ? 200 : 401);
  res.setHeader('Content-Type', 'application/json');
  res.send(
    JSON.stringify(
      session
        ? { success: true, access_token: session.token, expire_at: session.expiresAt }
        : { error: 'Invalid credentials', reason: 'invalid' }
    )
  );

  return true;
};

export const logoutStage: Stage = async ctx => {
  const { config, raw, req, res } = ctx;
  const logoutPath = config.logoutPath === false ? null : (config.logoutPath ?? '/auth/logout');
  if (!logoutPath || req.method !== 'POST' || req.path !== logoutPath) {
    return false;
  }

  if (refusedCrossSite(ctx)) {
    return true;
  }

  req.body = await readRawBody(raw);

  // Revoked at the source first, then forgotten by the browser: clearing the cookie alone would leave the
  // credential itself working until it expired, for anyone who had already copied it.
  await config.adapters.endSession?.(req);
  clearSessionCookies(req, res, config.authCookie);

  // On a navigation a 204 keeps the browser on the stale (still logged-in) page. Redirect so the view
  // re-renders in its logged-out state; a fetch can keep the lean 204.
  if (isNavigation(req)) {
    res.setStatus(303);
    res.setHeader('Location', safeRedirectTarget(req));
    res.end();

    return true;
  }

  res.setStatus(204);
  res.end();

  return true;
};

const isSessionScope = (value: unknown): value is SessionScope => value === 'site' || value === 'all';

/**
 * Signing the person out on every device (`endSessions`): `{ scope: 'site' }`, this host's sessions — a space's visitor
 * ending it on their phone too; `{ scope: 'all' }`, every session of the account. Said, never assumed: a sign-out the
 * page did not mean is one the person did not ask for. Guarded as a sign-out is — a page of another origin is refused.
 */
export const logoutEverywhereStage: Stage = async ctx => {
  const { config, raw, req, res } = ctx;
  const path =
    config.logoutEverywherePath === false ? null : (config.logoutEverywherePath ?? '/auth/logout-everywhere');
  const { endSessions } = config.adapters;
  if (!path || !endSessions || req.method !== 'POST' || req.path !== path) {
    return false;
  }

  if (refusedCrossSite(ctx)) {
    return true;
  }

  req.body = await readRawBody(raw);
  const { scope } = parseCredentials(req);
  const answer = (status: number, body: object): true => {
    res.setStatus(status);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(body));

    return true;
  };
  if (!isSessionScope(scope)) {
    return answer(400, {
      error:
        'Say which sessions end: { "scope": "site" } for this site\'s, { "scope": "all" } for every one of the account',
      reason: 'invalid'
    });
  }

  if (!(await endSessions(req, scope))) {
    return answer(401, { error: 'Nobody is signed in here', reason: 'missing' });
  }

  clearSessionCookies(req, res, config.authCookie);
  if (isNavigation(req)) {
    res.setStatus(303);
    res.setHeader('Location', safeRedirectTarget(req));
    res.end();

    return true;
  }

  return answer(200, { scope, ended: true });
};

export const authRoutesStages: Stage[] = [loginStage, logoutStage, logoutEverywhereStage, exchangeStage, signInStage];
