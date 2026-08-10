import type { IncomingHttpHeaders } from 'node:http';

/**
 * The shape both an Express `Request` and this server's own `SSRRequest` satisfy. Everything that reads a credential
 * off a request goes through it, so header/cookie precedence is stated once instead of once per transport.
 */
export interface CredentialCarrier {
  headers: IncomingHttpHeaders;
  hostname: string;
  query?: Record<string, unknown>;
  /** Populated by cookie-parser on Express; absent elsewhere, where the header is parsed. */
  cookies?: Record<string, string>;
}

const parseCookieHeader = (cookieHeader: string): Record<string, string> => {
  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const eqIndex = part.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }

    cookies[part.slice(0, eqIndex).trim()] = decodeURIComponent(part.slice(eqIndex + 1).trim());
  }

  return cookies;
};

const readCookies = (carrier: CredentialCarrier): Record<string, string> => {
  if (carrier.cookies) {
    return carrier.cookies;
  }

  const cookieHeader = carrier.headers.cookie;

  return cookieHeader ? parseCookieHeader(cookieHeader) : {};
};

const headerValue = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? '';

const bearer = (carrier: CredentialCarrier): string =>
  headerValue(carrier.headers.authorization).replace(/^Bearer\s+/i, '');

const unique = (candidates: string[]): string[] => [...new Set(candidates.filter(Boolean))];

/**
 * Where a credential of each kind is allowed to ride.
 *
 * `Authorization: Bearer` carries a session token on one role and a space token on another, so it is a candidate for
 * both and the typed verifier decides which it actually is — that is what `scope` is for. Trying the wrong kind
 * costs nothing: it fails on its scope claim before any database is touched.
 */
export const createCarriers = (sessionCookieName: (hostname: string) => string) => ({
  userTokenCandidates: (carrier: CredentialCarrier): string[] =>
    unique([
      headerValue(carrier.headers['plitzi-access-token']),
      bearer(carrier),
      readCookies(carrier)[sessionCookieName(carrier.hostname)] ?? ''
    ]),

  spaceTokenCandidates: (carrier: CredentialCarrier): string[] => {
    const queryToken = carrier.query?.['access-token'];

    return unique([
      headerValue(carrier.headers['x-access-token']),
      bearer(carrier),
      typeof queryToken === 'string' ? queryToken : ''
    ]);
  }
});

/**
 * The origin the caller claims to be presenting from — the `Origin` header, falling back to the host it addressed.
 * Distinct from this server's own origin (see `requestOrigin` in the request parser): this one is the claim a
 * credential's domain binding is checked against.
 */
export const presentedOrigin = (carrier: CredentialCarrier): string =>
  headerValue(carrier.headers.origin) || carrier.hostname;
