import type { SSRRequest } from '@plitzi/sdk-shared';

/**
 * A full-page form submission, as opposed to a script's fetch.
 *
 * The difference decides how an auth flow answers: a browser navigating away from a page it has already left shows
 * its own error page for a bodyless 401, and stays on the stale one for a 204. Either way the visitor sees the wrong
 * thing, so a navigation is answered with a redirect and the view re-renders through a GET. A fetch wants the body.
 */
export const isNavigation = (req: SSRRequest): boolean => req.headers['sec-fetch-mode'] === 'navigate';

/**
 * Same-origin only: absolute URLs and protocol-relative `//host` are refused, to avoid an open redirect — and so is
 * `/\host`, which a browser reads as `//host`.
 */
export const safeRedirectTarget = (req: SSRRequest, param = 'redirect'): string => {
  const target = req.query[param];

  return target && target.startsWith('/') && !/^\/[\\/]/u.test(target) ? target : '/';
};
