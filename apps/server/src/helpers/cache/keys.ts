import { debugCookieName } from '@plitzi/sdk-shared/devTools';
import { themeFromCookies } from '@plitzi/sdk-shared/theme';

import { readCookie } from '../readCookie';

/** The fields of an HTML key, in the order they are joined. */
const HTML_KEY_FIELDS = [
  'accessToken',
  'spaceId',
  'environment',
  'revision',
  'theme',
  'debugHidden',
  'hostname',
  'path',
  'search'
] as const;

type HtmlCacheKeyFields = Record<(typeof HTML_KEY_FIELDS)[number], string>;

/**
 * The key a rendered document is cached under.
 *
 * The visitor's theme is part of it because it is part of the DOCUMENT: `prepareRender` reads the `theme` cookie and
 * writes it onto `<html>` and into the props the SDK hydrates with. Keyed without it, the first visitor's choice was
 * served to everybody behind them — a dark page for a visitor who chose light, then corrected on hydration.
 *
 * So is whether the visitor hid the dev tools, on a page that authorizes them: the render leaves the panel out for
 * them and in for everybody else. It is the only value of that cookie that changes what is drawn, so it is the only
 * one keyed — a space that switched dev tools on for its published site would otherwise hand the first visitor's
 * choice to the rest.
 *
 * Read from the request here rather than handed in, so a call site cannot key the page without it. Only those two
 * cookies are read: keying the whole header would split the cache on every analytics cookie a visitor carries.
 */
export const buildHtmlCacheKey = (
  accessToken: string | undefined = 'anonymous',
  spaceId: number | string | null,
  environment: string,
  revision: number,
  req: { hostname: string; path: string; search: string; headers: { cookie?: string; host?: string } }
): string => {
  const fields: HtmlCacheKeyFields = {
    accessToken,
    spaceId: String(spaceId ?? 1),
    environment,
    revision: String(revision),
    theme: themeFromCookies(req.headers.cookie) ?? '',
    debugHidden: readCookie(req.headers.cookie, debugCookieName(req.headers.host)) === 'false' ? 'debug-off' : '',
    hostname: req.hostname,
    path: req.path,
    search: req.search
  };

  return HTML_KEY_FIELDS.map(field => fields[field]).join('\0');
};

/**
 * What an HTML key says about the page it holds, read by the one list that also writes it. `server.cache.invalidate`
 * filters on these; it used to split the key by positions of its own, and when the key grew a field in front the
 * filter went on reading the wrong ones — every invalidation by space matched nothing.
 */
export const readHtmlCacheKey = (key: string): { spaceId: string; environment: string; hostname: string } => {
  const parts = key.split('\0');
  const at = (field: (typeof HTML_KEY_FIELDS)[number]): string => parts[HTML_KEY_FIELDS.indexOf(field)] ?? '';

  return { spaceId: at('spaceId'), environment: at('environment'), hostname: at('hostname') };
};

export const buildOfflineDataCacheKey = (spaceId: number, environment: string, revision: number): string =>
  `${spaceId}|${environment}|${revision}`;

// The request URL is part of the key because RSC slices are route-dependent: a connector compiles its filters
// from routeParams/queryParams, so `/blog/a` and `/blog/b` resolve to different data under the same space,
// environment and revision. Keying the full `search` over-fragments the cache on tracking params (utm_*, fbclid),
// which costs hit rate — the alternative costs correctness, so the raw search stays in the key.
export const buildRscCacheKey = (
  spaceId: number,
  environment: string,
  revision: number,
  userId: string | number | undefined,
  idsParam: string | undefined,
  req: { hostname: string; path: string; search: string }
): string =>
  `${spaceId}\0${environment}\0${revision}\0${userId ?? 'anon'}\0${idsParam ?? ''}\0${req.hostname}\0${req.path}\0${req.search}`;
