import { readRawBody } from '../../requestParser';

import type { Auth } from '../../auth/createAuth';
import type { AuthRequest } from '../../auth/routes';
import type { BaseContext, Stage } from '../types';

const parseBody = (raw: string | undefined, contentType: string | undefined): unknown => {
  if (!raw) {
    return undefined;
  }

  if (typeof contentType === 'string' && contentType.includes('application/json')) {
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }

  return Object.fromEntries(new URLSearchParams(raw));
};

/**
 * Serves the `/auth` flows a session needs beyond signing in and out: renewing before the credential lapses,
 * answering who this is, revoking every session, and whichever of signup and password reset the deployment offers.
 *
 * A page server that stops at login and logout leaves a space unable to keep anybody signed in — the SDK renews
 * against `refreshUrl`, and with nothing there a visitor is signed out the moment their access token ages out. So
 * `createServer({ auth })` mounts these, and a deployment gets the whole cycle rather than the two ends of it.
 *
 * Login and logout keep the dedicated stages that run before this one: they redirect a form submission instead of
 * answering a bodyless 200, which is what a browser posting a `<form>` needs and an API client does not care about.
 */
export const createAuthApiStage = (auth: Auth, basePath = '/auth'): Stage<BaseContext> => {
  const byPath = new Map(auth.routes.map(route => [`${basePath}${route.path}`, route]));

  return async ctx => {
    const { req, res, raw } = ctx;
    const route = byPath.get(req.path);

    if (!route || route.method !== req.method) {
      return false;
    }

    // The guard runs here rather than in front of the whole pipeline: a page server answers plenty of requests
    // that are nobody's, and `/auth/session` is the one path that has to know the difference.
    const decision = await auth.authorize(req, req.path);
    if (!decision.ok) {
      res.setStatus(decision.status);
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({ error: 'Access Not Authorized', reason: decision.reason }));

      return true;
    }

    req.body = req.method === 'POST' ? await readRawBody(raw) : undefined;

    const authRequest: AuthRequest = {
      headers: req.headers,
      hostname: req.hostname,
      query: req.query,
      body: parseBody(req.body, req.headers['content-type']),
      actor: decision.actor
    };

    const outcome = await route.handler(authRequest);

    auth.applySession(req, res, outcome, auth.cookies);
    res.setStatus(outcome.ok ? (outcome.status ?? 200) : outcome.status);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(outcome.body));

    return true;
  };
};
