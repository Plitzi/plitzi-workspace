import { readRawBody } from '../../requestParser';

import type { Stage } from '../types';
import type { SSRRequest } from '@plitzi/sdk-shared';

// Same-origin only: reject absolute URLs and protocol-relative `//host` to avoid open redirects.
const safeRedirectTarget = (req: SSRRequest): string => {
  const redirectParam = req.query['redirect'];

  return redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//') ? redirectParam : '/';
};

export const loginStage: Stage = async ctx => {
  const { config, raw, req, res } = ctx;
  const loginPath = config.loginPath === false ? null : (config.loginPath ?? '/auth/login');
  if (!loginPath || req.method !== 'POST' || req.path !== loginPath) {
    return false;
  }

  req.body = await readRawBody(raw);
  const isLoggedIn = await config.adapters.onLogin?.(req, res);

  // A full-page form submission (navigation) must not be answered with a bodyless 401/200, or the browser
  // shows its own error page instead of the view. Redirect so the view re-renders via a GET.
  if (req.headers['sec-fetch-mode'] === 'navigate') {
    res.setStatus(303);
    res.setHeader('Location', isLoggedIn ? safeRedirectTarget(req) : loginPath);
    res.end();

    return true;
  }

  res.setStatus(isLoggedIn ? 200 : 401);
  res.end();

  return true;
};

export const logoutStage: Stage = async ctx => {
  const { config, raw, req, res } = ctx;
  const logoutPath = config.logoutPath === false ? null : (config.logoutPath ?? '/auth/logout');
  if (!logoutPath || req.method !== 'POST' || req.path !== logoutPath) {
    return false;
  }

  req.body = await readRawBody(raw);
  await config.adapters.onLogout?.(req, res);

  // On a navigation a 204 keeps the browser on the stale (still logged-in) page. Redirect so the view
  // re-renders in its logged-out state; a fetch can keep the lean 204.
  if (req.headers['sec-fetch-mode'] === 'navigate') {
    res.setStatus(303);
    res.setHeader('Location', safeRedirectTarget(req));
    res.end();

    return true;
  }

  res.setStatus(204);
  res.end();

  return true;
};

export const authRoutesStages: Stage[] = [loginStage, logoutStage];
