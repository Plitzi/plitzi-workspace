import { isIP } from 'node:net';

import type { SSRAuthCookie, SSRRequest, SSRSession } from '@plitzi/sdk-shared';

/**
 * Anything that can carry `Set-Cookie`. Express `Response` and this server's own helpers both satisfy it, which is
 * what lets one writer serve both — a deployment that wrote its own would drift from the one SSR uses, and a session
 * established on one side would be invisible to the other.
 */
export interface CookieSink {
  setHeader: (name: string, value: string | string[]) => void;
  getHeader?: (name: string) => string | string[] | number | undefined;
  headers?: Record<string, string | string[] | number | undefined>;
}

export type SessionCookieParams = {
  name: string;
  domain?: string;
  secure: boolean;
  sameSite: 'lax' | 'none';
  refreshPath: string;
  hintSuffix: string;
};

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

/**
 * Whether the host is a loopback name or a `.localhost` sibling. Local hosts get no Domain on their cookies (browsers
 * refuse one on a single-label host) and lax SameSite, because Secure + SameSite=None over plain http is dropped.
 */
export const isLocalHost = (hostname: string): boolean =>
  LOCAL_HOSTS.includes(hostname) || hostname.endsWith('.localhost');

// An address has no registrable domain: there is nothing to share the cookie across, and the labels an IP splits
// into are not a domain any browser would match a Domain against.
const isIpAddress = (hostname: string): boolean => isIP(hostname) !== 0;

/**
 * The last two labels of the host, so a session established on one sub-domain is carried by its siblings — an app
 * and the API it talks to are rarely the same host. Local and IP hosts get no domain at all: browsers refuse a
 * Domain on a single-label host, and one written for an address would never be sent back to it.
 */
const registrableDomain = (hostname: string): string | undefined => {
  if (isLocalHost(hostname) || isIpAddress(hostname)) {
    return undefined;
  }

  const match = /([^.]+\.[^.]+)$/.exec(hostname);

  return match ? `.${match[1]}` : undefined;
};

const resolve = <T>(value: T | ((hostname: string) => T) | undefined, hostname: string, fallback: T): T => {
  if (typeof value === 'function') {
    return (value as (hostname: string) => T)(hostname);
  }

  return value ?? fallback;
};

/**
 * Everything about how a session cookie is written, derived from the request host unless the deployment says
 * otherwise. The defaults are the ones a server on a real domain needs: a cookie shared across sub-domains, and
 * SameSite=None + Secure so it survives the app and the API being different hosts. A local server gets the
 * opposite, because Secure + SameSite=None over plain http is dropped by every browser.
 */
export const sessionCookieParams = (hostname: string, config: SSRAuthCookie = {}): SessionCookieParams => {
  const local = isLocalHost(hostname);

  return {
    name: resolve(config.name, hostname, 'plitzi_session'),
    domain: resolve(config.domain, hostname, registrableDomain(hostname)),
    secure: config.secure ?? !local,
    sameSite: config.sameSite ?? (local ? 'lax' : 'none'),
    refreshPath: config.refreshPath ?? '/auth',
    hintSuffix: config.hintSuffix ?? '_hint'
  };
};

/**
 * The value of the readable companion cookie: `<access expiry>.<refresh expiry>`, unix seconds, refresh optional.
 *
 * It exists because the session cookie is httpOnly — correctly — which leaves a page unable to tell whether the
 * browser holds a session at all. Answering that costs a request per page load otherwise, and the answer is usually
 * "nobody is signed in". This carries no credential: any script that can read it could have asked the backend the
 * same question with `credentials: 'include'`.
 */
export const sessionHintValue = (expiresAt: number, refreshExpiresAt?: number): string =>
  `${Math.floor(expiresAt)}.${refreshExpiresAt === undefined ? '' : Math.floor(refreshExpiresAt)}`;

const serializeCookie = (
  name: string,
  value: string,
  maxAgeSeconds: number,
  params: SessionCookieParams,
  { httpOnly = true, path = '/' }: { httpOnly?: boolean; path?: string } = {}
): string => {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    ...(httpOnly ? ['HttpOnly'] : []),
    `SameSite=${params.sameSite === 'none' ? 'None' : 'Lax'}`,
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`
  ];

  if (params.domain) {
    parts.push(`Domain=${params.domain}`);
  }

  if (params.secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
};

const nowInSeconds = (): number => Math.floor(Date.now() / 1000);

/**
 * Adds to `Set-Cookie` rather than replacing it. A handler may already have written one — clearing an OAuth flow
 * before granting the session it produced is exactly that — and replacing the header would silently drop it.
 */
const appendCookies = (res: CookieSink, cookies: string[]): void => {
  const existing = res.getHeader?.('set-cookie') ?? res.headers?.['set-cookie'];
  const previous = Array.isArray(existing) ? existing : typeof existing === 'string' ? [existing] : [];

  res.setHeader('Set-Cookie', [...previous, ...cookies]);
};

/**
 * Writes a granted session onto the response: the credential itself, the refresh half confined to its own path, and
 * the readable hint. One call, because the three only make sense together — a hint that outlives its session sends
 * clients to renew something that is gone, and one that dies early signs out a live session.
 */
export const writeSessionCookies = (
  req: { hostname: string },
  res: CookieSink,
  session: SSRSession,
  config?: SSRAuthCookie
): void => {
  const params = sessionCookieParams(req.hostname, config);
  const now = nowInSeconds();
  const cookies = [serializeCookie(params.name, session.token, session.expiresAt - now, params)];

  if (session.refreshToken) {
    cookies.push(
      serializeCookie(
        `${params.name}_refresh`,
        session.refreshToken,
        (session.refreshExpiresAt ?? session.expiresAt) - now,
        params,
        { path: params.refreshPath }
      )
    );
  }

  cookies.push(
    serializeCookie(
      `${params.name}${params.hintSuffix}`,
      sessionHintValue(session.expiresAt, session.refreshExpiresAt),
      // Outlives the access credential deliberately: it is the renewal window that says whether a session can
      // still be recovered, and a hint that expired with the access token would report one as gone.
      (session.refreshExpiresAt ?? session.expiresAt) - now,
      params,
      { httpOnly: false }
    )
  );

  appendCookies(res, cookies);
};

/** Ends the session in this browser. Every cookie the grant wrote is cleared, the readable one included. */
export const clearSessionCookies = (req: { hostname: string }, res: CookieSink, config?: SSRAuthCookie): void => {
  const params = sessionCookieParams(req.hostname, config);

  appendCookies(res, [
    serializeCookie(params.name, '', 0, params),
    serializeCookie(`${params.name}_refresh`, '', 0, params, { path: params.refreshPath }),
    serializeCookie(`${params.name}${params.hintSuffix}`, '', 0, params, { httpOnly: false })
  ]);
};

/**
 * The cookie a social sign-in leaves behind while the browser is away at the provider. Same family, same policy, so
 * it is written here rather than by whoever happens to be driving the flow. Path `/` because a deployment may serve
 * its API under a prefix, and the callback would then miss a cookie scoped to `/auth`.
 */
export const writeFlowCookie = (
  req: { hostname: string },
  res: CookieSink,
  value: string,
  ttlSeconds: number,
  config?: SSRAuthCookie
): void => {
  const params = sessionCookieParams(req.hostname, config);

  appendCookies(res, [serializeCookie(`${params.name}_oauth`, value, ttlSeconds, params)]);
};

export const clearFlowCookie = (req: { hostname: string }, res: CookieSink, config?: SSRAuthCookie): void => {
  const params = sessionCookieParams(req.hostname, config);

  appendCookies(res, [serializeCookie(`${params.name}_oauth`, '', 0, params)]);
};

/** The value that flow cookie carries, for the callback leg. */
export const readFlowCookie = (
  req: SSRRequest | { headers: { cookie?: string }; hostname: string },
  config?: SSRAuthCookie
): string | undefined => readCookie(req, `${sessionCookieParams(req.hostname, config).name}_oauth`);

const parseCookieHeader = (header: string): Record<string, string> => {
  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) {
      continue;
    }

    cookies[part.slice(0, separator).trim()] = decodeURIComponent(part.slice(separator + 1).trim());
  }

  return cookies;
};

const readCookie = (req: { headers: { cookie?: string } }, name: string): string | undefined => {
  const header = req.headers.cookie;

  return header ? parseCookieHeader(header)[name] || undefined : undefined;
};

/** The session credential this request carries, for an adapter that resolves identity from it. */
export const readSessionToken = (
  req: SSRRequest | { headers: { cookie?: string }; hostname: string },
  config?: SSRAuthCookie
): string | undefined => readCookie(req, sessionCookieParams(req.hostname, config).name);

/** The renewal credential, which rides in its own cookie confined to the refresh path. */
export const readRefreshToken = (
  req: SSRRequest | { headers: { cookie?: string }; hostname: string },
  config?: SSRAuthCookie
): string | undefined => readCookie(req, `${sessionCookieParams(req.hostname, config).name}_refresh`);

/** Anything a credential can be read off: this server's own request, an Express one, a bare `node:http` one. */
export type CookieCarrier = SSRRequest | { headers: { cookie?: string; authorization?: string }; hostname: string };

/**
 * The cookie side of a session with this deployment's naming already bound in.
 *
 * The functions above take the naming on every call, which is right for the server's own internals and tedious for a
 * host that answers dozens of requests with the same configuration. Nothing here knows about any framework: it takes
 * a request that can be read and something that can carry `Set-Cookie`, which is as true of `node:http` as it is of
 * Express — a self-hoster running neither still gets the whole cycle.
 */
export const createSessionCookies = (config?: SSRAuthCookie) => ({
  write: (req: { hostname: string }, res: CookieSink, session: SSRSession): void =>
    writeSessionCookies(req, res, session, config),

  clear: (req: { hostname: string }, res: CookieSink): void => clearSessionCookies(req, res, config),

  /** Holds a social sign-in between its two legs: the CSRF nonce and the PKCE verifier. */
  writeFlow: (req: { hostname: string }, res: CookieSink, value: string, ttlSeconds: number): void =>
    writeFlowCookie(req, res, value, ttlSeconds, config),

  clearFlow: (req: { hostname: string }, res: CookieSink): void => clearFlowCookie(req, res, config),

  readFlow: (req: CookieCarrier): string | undefined => readFlowCookie(req, config),

  /**
   * The session credential from `Authorization: Bearer` or the cookie, so one endpoint serves a bearer client and a
   * browser. The header wins: a caller that went to the trouble of presenting one means it.
   */
  resolveSessionToken: (req: CookieCarrier): string | undefined => {
    const header = req.headers.authorization;
    const presented = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';

    return presented || readSessionToken(req, config);
  },

  /**
   * The renewal credential from the request body (`refresh_token`, for API clients) or its cookie (for browsers).
   * The body wins when both are present, mirroring how the session credential is resolved. `body` is whatever the
   * host parsed — this only reads one field off it, so a host that parses JSON its own way still fits.
   */
  resolveRefreshToken: (req: CookieCarrier, body?: unknown): string | undefined => {
    const presented = (body as { refresh_token?: unknown } | undefined)?.refresh_token;

    if (typeof presented === 'string' && presented.trim() !== '') {
      return presented.trim();
    }

    return readRefreshToken(req, config);
  }
});

export type SessionCookies = ReturnType<typeof createSessionCookies>;
