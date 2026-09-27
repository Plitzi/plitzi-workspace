import { isDocumentNavigation, renewForNavigation } from '../../auth/renewal';
import { readRenewalGuard, readSessionHint, readSessionToken, writeRenewalGuard } from '../../auth/session';

import type { Auth } from '../../auth/createAuth';
import type { BaseContext, Stage } from '../types';
import type { SSRAuthCookie, SSRRequest } from '@plitzi/sdk-shared';

/** Renewal this close to its deadline is not worth the round trip: it would be refused on arrival. */
const REFRESH_MARGIN_SECONDS = 30;

const nowInSeconds = (): number => Math.floor(Date.now() / 1000);

/**
 * This page's own address, absolute, for a renewal served by another host to send the browser back to. The port is
 * read off the authority rather than taken whole, so a forged `Host` cannot put anything but digits after the name.
 */
const pageUrl = (req: SSRRequest): string => {
  const authority = req.headers[':authority'] ?? req.headers.host ?? '';
  const port = /:(\d{1,5})$/u.exec(authority)?.[1];

  return `${req.protocol}://${req.hostname}${port ? `:${port}` : ''}${req.path}${req.search}`;
};

/**
 * Whether this page request comes from a browser whose session has only half-lapsed.
 *
 * The access cookie dies with its token, while the refresh cookie lives on — confined to the refresh path, so it never
 * reaches a page. Rendered now, the page would be a guest's, and the browser, which renews as soon as it boots, would
 * swap it for the signed-in one: a guest page in the HTML, a different page on screen, and a guest-only page shown
 * and then redirected away from instead of answered with a redirect.
 *
 * The readable hint is what tells the two apart without presenting anything: it outlives the access cookie exactly
 * as long as renewal is still possible. It is also what keeps this from looping — a renewal that succeeds rewrites
 * it with an access expiry in the future, one that is refused clears it, and one that fails any other way leaves the
 * guard cookie behind.
 */
const halfLapsed = (req: SSRRequest, cookie: SSRAuthCookie | undefined): boolean => {
  if (readSessionToken(req, cookie) !== undefined || readRenewalGuard(req, cookie)) {
    return false;
  }

  const hint = readSessionHint(req, cookie);
  if (!hint?.refreshExpiresAt) {
    return false;
  }

  const now = nowInSeconds();

  return hint.expiresAt <= now && hint.refreshExpiresAt > now + REFRESH_MARGIN_SECONDS;
};

/**
 * Sends a page request from a half-lapsed session to renew first — to `url`, the renewal endpoint — so the server
 * renders the visitor the browser is going to end up with. See `renewForNavigation` for the other half.
 *
 * `url` is a path when this server serves `/auth` itself, and an absolute URL when another host does; the page's
 * own address travels as `redirect` accordingly, and the endpoint only sends the browser back to a host that shares
 * the session's cookies. Only whole-tab `GET` navigations take part: a renewal rotates the session.
 */
export const createSessionRenewalStage = (url: string): Stage<BaseContext> => {
  const sameHost = url.startsWith('/') && !url.startsWith('//');
  const renewalPath = sameHost ? new URL(url, 'http://localhost').pathname : undefined;

  return ({ req, res, config }) => {
    if (req.method !== 'GET' || req.path === renewalPath || !isDocumentNavigation(req.headers)) {
      return false;
    }

    if (!halfLapsed(req, config.authCookie)) {
      return false;
    }

    const target = new URL(url, pageUrl(req));
    target.searchParams.set('redirect', sameHost ? `${req.path}${req.search}` : pageUrl(req));

    writeRenewalGuard(req, res, config.authCookie);

    res.setStatus(303);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Location', sameHost ? `${target.pathname}${target.search}` : target.toString());
    res.end();

    return true;
  };
};

/**
 * The renewal endpoint, on a page server that serves `/auth` itself: `GET <basePath>/refresh`. The `POST` flow at the
 * same path is the auth API stage's; this one only ever answers a whole-tab navigation.
 */
export const createRenewalEndpointStage = (auth: Auth): Stage<BaseContext> => {
  const path = `${auth.basePath}/refresh`;

  return async ({ req, res }) => {
    if (req.method !== 'GET' || req.path !== path || !isDocumentNavigation(req.headers)) {
      return false;
    }

    const location = await renewForNavigation(req, res, { api: auth.api, cookies: auth.cookies, csrf: auth.csrf });

    res.setStatus(303);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Location', location);
    res.end();

    return true;
  };
};
