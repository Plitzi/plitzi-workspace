import type { SSRAuthCookie, SSRRequest, SSRResponseHelpers, SSRSession } from '@plitzi/sdk-shared';

export type SessionCookieParams = {
  name: string;
  domain?: string;
  secure: boolean;
  sameSite: 'lax' | 'none';
  refreshPath: string;
  hintSuffix: string;
};

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

const isLocal = (hostname: string): boolean => LOCAL_HOSTS.includes(hostname) || hostname.endsWith('.localhost');

/**
 * The last two labels of the host, so a session established on one sub-domain is carried by its siblings — an app
 * and the API it talks to are rarely the same host. Localhost gets no domain at all: browsers refuse a Domain on a
 * single-label host, and setting one there silently drops the cookie.
 */
const registrableDomain = (hostname: string): string | undefined => {
  if (isLocal(hostname)) {
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
  const local = isLocal(hostname);

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
 * Writes a granted session onto the response: the credential itself, the refresh half confined to its own path, and
 * the readable hint. One call, because the three only make sense together — a hint that outlives its session sends
 * clients to renew something that is gone, and one that dies early signs out a live session.
 */
export const writeSessionCookies = (
  req: SSRRequest,
  res: SSRResponseHelpers,
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

  res.setHeader('Set-Cookie', cookies);
};

/** Ends the session in this browser. Every cookie the grant wrote is cleared, the readable one included. */
export const clearSessionCookies = (req: SSRRequest, res: SSRResponseHelpers, config?: SSRAuthCookie): void => {
  const params = sessionCookieParams(req.hostname, config);

  res.setHeader('Set-Cookie', [
    serializeCookie(params.name, '', 0, params),
    serializeCookie(`${params.name}_refresh`, '', 0, params, { path: params.refreshPath }),
    serializeCookie(`${params.name}${params.hintSuffix}`, '', 0, params, { httpOnly: false })
  ]);
};

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

/** The session credential this request carries, for an adapter that resolves identity from it. */
export const readSessionToken = (req: SSRRequest, config?: SSRAuthCookie): string | undefined => {
  const header = req.headers.cookie;
  if (!header) {
    return undefined;
  }

  return parseCookieHeader(header)[sessionCookieParams(req.hostname, config).name] || undefined;
};
