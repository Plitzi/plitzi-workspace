import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { appendCookies, sessionCookieParams } from './session';

import type { CookieSink } from './session';
import type { SSRAuthCookie } from '@plitzi/sdk-shared';

/**
 * Cross-site request forgery, for the requests that are authenticated by a COOKIE.
 *
 * A cookie is attached by the browser to every request to its origin, including ones another site caused. That is
 * the whole attack, and the reason it is not hypothetical here: `sessionCookieParams` defaults `SameSite` to
 * `None` off localhost, because a Plitzi space is embedded in an iframe on somebody else's domain. `None` means
 * the browser sends the session cookie on cross-site requests, which is exactly what `Lax` exists to prevent.
 *
 * A request carrying `Authorization: Bearer` is NOT at risk and is never asked for a token: a cross-origin page
 * cannot set that header without a preflight the server would have to allow. Requiring one there would break every
 * API client to protect nobody.
 *
 * The design is the signed double-submit cookie. The token is an HMAC over a nonce **and the session it belongs
 * to**, handed to the page in a readable cookie and echoed back in a header. An attacker's page cannot read the
 * cookie, so it cannot produce the header; and unlike plain double-submit, somebody who can merely *write* a
 * cookie — a sub-domain they took over — still cannot forge one, because they do not have the secret.
 */

const VERSION = 'v1';

/** GET, HEAD and OPTIONS change nothing, and demanding a token for them would break every ordinary navigation. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface CsrfConfig {
  /** Signs the tokens. Distinct from the session secret is fine; `createAuth` reuses that one by default. */
  secret: string;
  /** The readable cookie the token is handed over in. Defaults to the session cookie's name plus `_csrf`. */
  cookieName?: string | ((hostname: string) => string);
  /** Where the echo is looked for. Defaults to `x-csrf-token`. */
  headerName?: string;
  /** A body field to accept it in as well, for a form that posts without JavaScript. Defaults to `_csrf`. */
  fieldName?: string;
  /** Seconds. Default 43200 (twelve hours) — long enough for a working day, short enough to bound a leak. */
  ttlSeconds?: number;
  /** Naming and scope for the cookie, so it lands beside the session one. */
  cookie?: SSRAuthCookie;
  /**
   * Also demand a token on requests that carry NO session — signing in, above all.
   *
   * Off by default, and the reason is what CSRF actually is: the attack is that the browser attaches the victim's
   * credentials to a request another site caused. A request with no session cookie carries no credentials, so
   * there is nothing to forge, and demanding a token there costs every client a round trip before it can sign in.
   *
   * What it *does* buy is protection from login CSRF — another site signing a visitor into an account it controls,
   * so that what they do next is recorded against it. A real attack, a lesser one, and one whose cost lands on
   * every client. So it is a deployment's choice rather than a default.
   */
  protectSignIn?: boolean;
}

export type CsrfFailure = 'missing' | 'malformed' | 'expired' | 'mismatch';

export const csrfFailureMessage: Record<CsrfFailure, string> = {
  missing: 'A CSRF token is required',
  malformed: 'CSRF token malformed',
  expired: 'CSRF token expired',
  mismatch: 'CSRF token does not match this session'
};

export type CsrfResult = { ok: true } | { ok: false; reason: CsrfFailure };

/** What a request has to look like for this to read it. Satisfied by Express, `node:http` plus a parse, and ours. */
export interface CsrfCarrier {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  hostname: string;
  cookies?: Record<string, string>;
  body?: unknown;
}

const equal = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  // Length is not secret, and timingSafeEqual throws on a mismatch, so it is checked first and separately.
  return left.length === right.length && timingSafeEqual(left, right);
};

const header = (carrier: CsrfCarrier, name: string): string | undefined => {
  const value = carrier.headers[name];

  return typeof value === 'string' ? value : undefined;
};

const readCookieHeader = (carrier: CsrfCarrier, name: string): string | undefined => {
  if (carrier.cookies?.[name] !== undefined) {
    return carrier.cookies[name];
  }

  const raw = header(carrier, 'cookie');
  if (!raw) {
    return undefined;
  }

  for (const part of raw.split(';')) {
    const index = part.indexOf('=');
    if (index !== -1 && part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }

  return undefined;
};

export const createCsrf = (config: CsrfConfig) => {
  const {
    secret,
    headerName = 'x-csrf-token',
    fieldName = '_csrf',
    ttlSeconds = 43_200,
    cookie,
    protectSignIn = false
  } = config;

  const nameFor = (hostname: string): string => {
    if (typeof config.cookieName === 'function') {
      return config.cookieName(hostname);
    }

    return config.cookieName ?? `${sessionCookieParams(hostname, cookie).name}_csrf`;
  };

  const sign = (nonce: string, expiry: number, binding: string): string =>
    createHmac('sha256', secret).update(`${nonce}.${expiry}.${binding}`).digest('base64url');

  /**
   * `binding` is what ties a token to one session. Hashed rather than used raw so the token never carries a
   * credential, even indirectly: it goes in a cookie a page can read.
   */
  const bind = (sessionToken?: string): string =>
    sessionToken ? createHmac('sha256', secret).update(sessionToken).digest('base64url') : '';

  /**
   * A token for this session, or for none.
   *
   * The unbound form is what protects sign-in itself: a page asks for one before anybody is authenticated, which
   * is what stops another site logging a visitor into an account it controls. It is upgraded to a bound one the
   * moment a session exists, and a bound token is refused for a different session.
   */
  const issue = (sessionToken?: string): string => {
    const nonce = randomBytes(16).toString('base64url');
    const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;

    return `${VERSION}.${nonce}.${expiry}.${sign(nonce, expiry, bind(sessionToken))}`;
  };

  const check = (token: string | undefined, sessionToken?: string): CsrfResult => {
    if (!token) {
      return { ok: false, reason: 'missing' };
    }

    const [version, nonce, expiry, signature] = token.split('.');
    if (version !== VERSION || !nonce || !expiry || !signature) {
      return { ok: false, reason: 'malformed' };
    }

    const expiresAt = Number(expiry);
    if (!Number.isFinite(expiresAt)) {
      return { ok: false, reason: 'malformed' };
    }

    if (expiresAt < Math.floor(Date.now() / 1000)) {
      return { ok: false, reason: 'expired' };
    }

    /**
     * Verified against the session the request actually carries. A token minted for nobody does NOT satisfy a
     * request that has a session — otherwise an attacker could mint one from their own browser, where they are
     * signed out, and replay it against a victim who is not.
     */
    if (!equal(signature, sign(nonce, expiresAt, bind(sessionToken)))) {
      return { ok: false, reason: 'mismatch' };
    }

    return { ok: true };
  };

  return {
    issue,

    /** The name the cookie lands under, for a client that reads it by hand. */
    cookieName: nameFor,

    headerName,

    /** Readable on purpose: `httpOnly` would make it impossible for a page to echo it back. It is not a credential. */
    write: (req: { hostname: string }, res: CookieSink, token: string): void => {
      const params = sessionCookieParams(req.hostname, cookie);
      const parts = [
        `${nameFor(req.hostname)}=${encodeURIComponent(token)}`,
        'Path=/',
        `SameSite=${params.sameSite === 'none' ? 'None' : 'Lax'}`,
        `Max-Age=${ttlSeconds}`,
        ...(params.domain ? [`Domain=${params.domain}`] : []),
        ...(params.secure ? ['Secure'] : [])
      ];

      appendCookies(res, [parts.join('; ')]);
    },

    read: (carrier: CsrfCarrier): string | undefined => readCookieHeader(carrier, nameFor(carrier.hostname)),

    /**
     * Does this request need a token at all?
     *
     * Three noes, and each is a request that cannot be forged into:
     *
     * - a **safe method**, which changes nothing;
     * - one presenting **`Authorization: Bearer`** — a cross-origin page cannot set that header without a
     *   preflight this server would have to allow, so requiring a token would break every API client to protect
     *   nobody;
     * - one carrying **no session cookie**, which carries no credentials for a browser to attach. Signing in is
     *   the case that matters here, and `protectSignIn` is how a deployment opts into covering it too.
     */
    required: (carrier: CsrfCarrier): boolean => {
      if (SAFE_METHODS.has((carrier.method ?? 'GET').toUpperCase()) || header(carrier, 'authorization')) {
        return false;
      }

      if (protectSignIn) {
        return true;
      }

      return readCookieHeader(carrier, sessionCookieParams(carrier.hostname, cookie).name) !== undefined;
    },

    /**
     * The whole check. The echoed token must verify against the session the request carries, and — when the
     * cookie is also present — match it. The second half costs nothing and blocks a token that leaked somewhere
     * the cookie did not.
     */
    verify: (carrier: CsrfCarrier, sessionToken?: string): CsrfResult => {
      const field = (carrier.body as Record<string, unknown> | undefined)?.[fieldName];
      const echoed = header(carrier, headerName) ?? (typeof field === 'string' ? field : undefined);

      const result = check(echoed, sessionToken);
      if (!result.ok) {
        return result;
      }

      const fromCookie = readCookieHeader(carrier, nameFor(carrier.hostname));
      if (fromCookie !== undefined && !equal(fromCookie, echoed as string)) {
        return { ok: false, reason: 'mismatch' };
      }

      return { ok: true };
    }
  };
};

export type Csrf = ReturnType<typeof createCsrf>;
