import { debugCookieName } from '@plitzi/sdk-shared/devTools';
import { flagsCookieName } from '@plitzi/sdk-shared/flags';
import { themeFromCookies } from '@plitzi/sdk-shared/theme';

import { ssrPaintedCookieName } from '../paintedCookie';
import { readCookie } from '../readCookie';

/** What a cache key reads off a request: where it is, and — from the resolved deployment — what the flags are at. */
type CacheKeyRequest = {
  hostname: string;
  path: string;
  search: string;
  ctx?: { spaceDeployment?: { flagsVersion?: string } };
};

const flagsVersionOf = (req: CacheKeyRequest): string => req.ctx?.spaceDeployment?.flagsVersion ?? '';

/** The fields of an HTML key, in the order they are joined. */
const HTML_KEY_FIELDS = [
  'accessToken',
  'spaceId',
  'environment',
  'revision',
  'flags',
  'theme',
  'painted',
  'debugHidden',
  'forcedFlags',
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
 * So is the kept state the first paint depends on (`settings.paintedState`): `prepareRender` renders with that cookie's
 * values, so a page drawn with one visitor's toolbar must not be served to the next. Keyed by its raw value — this
 * key does not know which keys a space declares, and a space that declares none has no such cookie to split on.
 *
 * So are the feature flags a tester forced from the dev tools, on a page that authorizes debugging: drawn with them,
 * the page is not everybody's, and a tester holding the cookie must never be handed a page drawn without it. Keyed
 * by its raw value, like the kept state.
 *
 * So is what the space's flags are at (`flagsVersion` on the resolved deployment), for a deployment that changes them
 * apart from its revisions: a flag turned in production must reach the next visitor, while the revision is the same.
 *
 * Read from the request here rather than handed in, so a call site cannot key the page without it. Only those
 * cookies are read: keying the whole header would split the cache on every analytics cookie a visitor carries.
 */
export const buildHtmlCacheKey = (
  accessToken: string | undefined = 'anonymous',
  spaceId: number | string | null,
  environment: string,
  revision: number,
  req: CacheKeyRequest & { headers: { cookie?: string; host?: string } }
): string => {
  const fields: HtmlCacheKeyFields = {
    accessToken,
    spaceId: String(spaceId ?? 1),
    environment,
    revision: String(revision),
    flags: flagsVersionOf(req),
    theme: themeFromCookies(req.headers.cookie) ?? '',
    painted: readCookie(req.headers.cookie, ssrPaintedCookieName(req.headers.host)) ?? '',
    debugHidden: readCookie(req.headers.cookie, debugCookieName(req.headers.host)) === 'false' ? 'debug-off' : '',
    forcedFlags: readCookie(req.headers.cookie, flagsCookieName(req.headers.host)) ?? '',
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

/** The space as read for a render: its revision, and what its flags are at when they change apart from it. */
export const buildOfflineDataCacheKey = (
  spaceId: number,
  environment: string,
  revision: number,
  flagsVersion: string | undefined
): string => `${spaceId}|${environment}|${revision}|${flagsVersion ?? ''}`;

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
  req: CacheKeyRequest
): string =>
  `${spaceId}\0${environment}\0${revision}\0${flagsVersionOf(req)}\0${userId ?? 'anon'}\0${idsParam ?? ''}\0${req.hostname}\0${req.path}\0${req.search}`;
