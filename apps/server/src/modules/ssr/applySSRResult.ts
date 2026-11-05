import { SPACE_TOKEN_PARAM } from '@plitzi/sdk-kernel/identity';
import { PREVIEW_TOKEN_PARAM } from '@plitzi/sdk-kernel/identity';

import type { SSRResponseHelpers } from '@plitzi/sdk-kernel/types';
import type { SSRRenderResult } from '@plitzi/sdk-shared';

/**
 * What names the render rather than the page: the space (`access-token`, on a host serving many) and the draft (`__pt`).
 * A redirect within the site that dropped them landed on another space, or the live one, without its preview session —
 * a space's journey on a page for signed-in visitors, opened by the server's runner, lost the space it was playing.
 */
const RENDER_PARAMS = [SPACE_TOKEN_PARAM, PREVIEW_TOKEN_PARAM] as const;

/** The render's own parameters the request carried, to keep on a redirect within the site. */
export const renderParamsOf = (query: Record<string, string>): [string, string][] =>
  RENDER_PARAMS.flatMap((name): [string, string][] => (query[name] ? [[name, query[name]]] : []));

/**
 * `location` with the render's parameters, when it is on this site — a path. An address on another origin is never
 * given them: a space token sent there is a credential handed to somebody else.
 */
const withRenderParams = (location: string, params: readonly [string, string][]): string => {
  if (params.length === 0 || !location.startsWith('/') || location.startsWith('//')) {
    return location;
  }

  // Any base: only the path, query and hash are read back.
  const url = new URL(location, 'http://site.invalid');
  for (const [name, value] of params) {
    if (!url.searchParams.has(name)) {
      url.searchParams.set(name, value);
    }
  }

  return `${url.pathname}${url.search}${url.hash}`;
};

// Applies the result produced during the React SSR render onto the HTTP response. Returns true when the
// response is complete (a redirect was emitted) and the caller must stop without sending an HTML body.
// `kept`: the request's render parameters (`renderParamsOf`), carried onto a redirect within the site.
export const applySSRResult = (
  res: SSRResponseHelpers,
  result: SSRRenderResult,
  kept: readonly [string, string][] = []
): boolean => {
  if (result.headers) {
    for (const [name, value] of Object.entries(result.headers)) {
      res.setHeader(name, value);
    }
  }

  if (result.redirect !== undefined) {
    res.setStatus(result.status ?? 302);
    res.setHeader('Location', withRenderParams(result.redirect, kept));
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

/**
 * A page withheld from this visitor answers 401 signed out and 403 signed in without the access — unless the render
 * decided something of its own first: the redirect to signing in a page declares, say.
 */
export const withRefusal = (result: SSRRenderResult, refused: 'unauthenticated' | 'forbidden' | undefined): void => {
  if (refused && result.redirect === undefined && result.status === undefined) {
    result.status = refused === 'unauthenticated' ? 401 : 403;
  }
};
