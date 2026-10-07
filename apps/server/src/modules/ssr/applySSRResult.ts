import type { SSRRenderResult, SSRResponseHelpers } from '@plitzi/sdk-shared';

// Applies the result produced during the React SSR render onto the HTTP response. Returns true when the
// response is complete (a redirect was emitted) and the caller must stop without sending an HTML body.
export const applySSRResult = (res: SSRResponseHelpers, result: SSRRenderResult): boolean => {
  if (result.headers) {
    for (const [name, value] of Object.entries(result.headers)) {
      res.setHeader(name, value);
    }
  }

  if (result.redirect !== undefined) {
    res.setStatus(result.status ?? 302);
    res.setHeader('Location', result.redirect);
    res.send('');

    return true;
  }

  if (result.status !== undefined) {
    res.setStatus(result.status);
  }

  return false;
};

/**
 * Whether a render may be kept and served again: only a page that answered 200. A cached page is sent without the
 * status it was rendered with, and a "not found" kept per address would let anybody asking for addresses at random
 * push every real page out of the cache.
 */
export const isReusable = (result: SSRRenderResult): boolean => result.status === undefined || result.status === 200;

/**
 * A page a server provider said shows nothing (`notFound`) answers 404 — unless the render decided something of its
 * own first: a redirect, or a status the navigation set.
 */
export const withNotFound = (result: SSRRenderResult, notFound: boolean): void => {
  if (notFound && result.redirect === undefined && result.status === undefined) {
    result.status = 404;
  }
};
