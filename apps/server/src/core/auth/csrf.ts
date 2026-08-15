import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { appendCookies, sessionCookieParams } from './session';

import type { CookieSink } from './session';
import type { SSRAuthCookie } from '@plitzi/sdk-shared';

/**
 * Cross-site request forgery: a page on another site causing a request here that the visitor did not mean to make.
 *
 * There are **two** attacks under that name, and they need different answers — conflating them is how a server
 * ends up either refusing legitimate sign-ins or leaving login CSRF wide open.
 *
 * 1. **An action taken as somebody.** A cookie is attached by the browser to every request to its origin,
 *    including ones another site caused. Not hypothetical here: `sessionCookieParams` defaults `SameSite` to
 *    `None` off localhost, because a Plitzi space is embedded in an iframe on somebody else's domain — which is
 *    exactly what `Lax` exists to prevent. Answered by a token, demanded whenever a session cookie is present.
 * 2. **Login CSRF.** Another site signs the visitor into an account IT controls, so what they do next is recorded
 *    against it. There is no cookie yet to look for, so the first answer does not apply at all. Answered by
 *    `foreign` below: where the request came from, which is what separates it from a legitimate sign-in.
 *
 * A request carrying `Authorization: Bearer` is at risk from neither and is never asked for a token: a
 * cross-origin page cannot set that header without a preflight the server would have to allow. Requiring one
 * there would break every API client to protect nobody.
 *
 * The token is a signed double-submit cookie: an HMAC over a nonce **and the session it belongs to**, handed to
 * the page in a readable cookie and echoed back in a header. An attacker's page cannot read the cookie, so it
 * cannot produce the header; and unlike plain double-submit, somebody who can merely *write* a cookie — a
 * sub-domain they took over — still cannot forge one, because they do not have the secret.
 */

const VERSION = 'v1';

/** GET, HEAD and OPTIONS change nothing, and demanding a token for them would break every ordinary navigation. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface CsrfConfig {
  /** Signs the tokens. `createAuth` uses the token secret, so a deployment never states this either. */
  secret: string;
  /** Naming and scope for the cookie, so it lands beside the session one. */
  cookie?: SSRAuthCookie;
  /**
   * Origins that count as this deployment's own, beyond the request's own site.
   *
   * What it decides is which cross-site page may hand out a session — see `foreign` below. `createAuth` fills it
   * from `identity.platformOrigins`, so a deployment that already declared its hosts has said this too, and this
   * whole module ends up configuring itself.
   */
  allowedOrigins?: string[] | ((origin: string) => boolean);
}

/** Where the echo is looked for, and the field a `<form>` may carry it in instead. */
const HEADER_NAME = 'x-csrf-token';
const FIELD_NAME = '_csrf';

/** Twelve hours: long enough for a working day, short enough to bound a leak. */
const TOKEN_LIFETIME = 43_200;

/**
 * What kind of flow a request is reaching, which is what decides when a token is demanded.
 *
 * - **`write`** — an action taken as somebody. Guarded whenever a cookie could have authenticated it.
 * - **`signIn`** — hands out a session. There is no cookie to protect yet, and the attack is different: another
 *   site signing a visitor into an account IT controls, so that what they do next is recorded against it. Guarded
 *   by where the request came from, since that is what separates the attack from every legitimate sign-in.
 * - **`delegated`** — also hands out a session, but the flow checks the caller's origin itself against something
 *   narrower than any list here: `/auth/exchange` acts for a space and is refused unless the origin is one that
 *   space declared. Applying the check below on top would refuse every legitimate embed.
 */
export type CsrfSubject = 'write' | 'signIn' | 'delegated';

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

/** The host out of an `Origin`, which is a serialized origin (`https://acme.test:8443`) and never a bare host. */
const originHost = (origin: string): string | undefined => {
  try {
    return new URL(origin).hostname;
  } catch {
    // `null` — a sandboxed iframe, a `data:` document. Not a host, and deliberately not one anything may allow.
    return undefined;
  }
};

export const createCsrf = (config: CsrfConfig) => {
  const { secret, cookie, allowedOrigins = [] } = config;

  const permitted = (origin: string): boolean =>
    typeof allowedOrigins === 'function' ? allowedOrigins(origin) : allowedOrigins.includes(origin);

  /**
   * Did this request come from a site this deployment does not recognise?
   *
   * This is what protects signing in, where there is no session to bind a token to and no cookie to look for. It
   * rests on two headers a page CANNOT set — the browser attaches both, and script may not override either:
   *
   * - **`Sec-Fetch-Site`** is the browser's own account of where the request came from, and is believed first.
   *   Anything but `cross-site` (`same-origin`, `same-site`, or `none` for a typed URL) is this deployment's own.
   *   The browser works that out with the real public suffix list, which is why it is worth more than anything
   *   derivable here.
   * - **`Origin`** is the fallback, for a browser too old to send the above — Safari only did from 16.4. Matched
   *   **exactly**, against this host or an origin the deployment named.
   *
   * That exactness is deliberate and was a bug once: this compared *registrable domains*, last-two-labels, the
   * same helper that scopes the session cookie. It has no public suffix list, so on a deployment at `acme.co.uk`
   * every other `.co.uk` in the world counted as the same site and could sign a visitor in. Guessing where a
   * domain boundary falls is not something to do in a security decision — a sibling sub-domain that needs to be
   * trusted is one line in `allowedOrigins`, which `createAuth` already fills from `identity.platformOrigins`.
   *
   * **Neither header means this is not a browser**, and a client that is not a browser cannot be made to forge
   * anything: there is no victim's session sitting in it. That is what keeps every API client, mobile app and
   * script signing in with nothing extra to send.
   */
  const foreign = (carrier: CsrfCarrier): boolean => {
    const site = header(carrier, 'sec-fetch-site');
    const origin = header(carrier, 'origin');
    const allowed = origin !== undefined && permitted(origin);

    if (site !== undefined) {
      // The browser has answered the question. `same-origin`, `same-site` and `none` (a typed URL, a bookmark)
      // are all this deployment's own; a `cross-site` one is foreign unless its origin was explicitly allowed.
      return site === 'cross-site' && !allowed;
    }

    if (!origin) {
      return false;
    }

    // An opaque origin — a sandboxed iframe, a `data:` document — has no host at all, and nothing can vouch for it.
    return originHost(origin) !== carrier.hostname && !allowed;
  };

  const nameFor = (hostname: string): string => `${sessionCookieParams(hostname, cookie).name}_csrf`;

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
    const expiry = Math.floor(Date.now() / 1000) + TOKEN_LIFETIME;

    return `${VERSION}.${nonce}.${expiry}.${sign(nonce, expiry, bind(sessionToken))}`;
  };

  /** One place the cookie's attributes are decided, so writing it and dropping it cannot disagree about them. */
  const serialize = (hostname: string, value: string, maxAge: number): string => {
    const params = sessionCookieParams(hostname, cookie);

    return [
      `${nameFor(hostname)}=${value}`,
      'Path=/',
      `SameSite=${params.sameSite === 'none' ? 'None' : 'Lax'}`,
      `Max-Age=${maxAge}`,
      ...(params.domain ? [`Domain=${params.domain}`] : []),
      ...(params.secure ? ['Secure'] : [])
    ].join('; ');
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

    /** The header the echo is expected in, published by `GET /auth/csrf` so a client is never told it twice. */
    headerName: HEADER_NAME,

    /** Readable on purpose: `httpOnly` would make it impossible for a page to echo it back. It is not a credential. */
    write: (req: { hostname: string }, res: CookieSink, token: string): void => {
      appendCookies(res, [serialize(req.hostname, encodeURIComponent(token), TOKEN_LIFETIME)]);
    },

    /**
     * Drops the cookie, on the same attributes it was written with — anything else leaves the original in place and
     * adds a second one the browser then has to choose between.
     *
     * Called when a session ends. Nothing depended on it going: the token is signed over the session it belongs to,
     * so once that session is revoked it verifies against nothing, and a write is only ever asked for a token when a
     * session cookie is present. But a logout that leaves a cookie behind is one somebody has to reason about to
     * dismiss, and on a shared browser "signed out" should mean nothing of the session is still sitting there.
     */
    clear: (req: { hostname: string }, res: CookieSink): void => {
      appendCookies(res, [serialize(req.hostname, '', 0)]);
    },

    read: (carrier: CsrfCarrier): string | undefined => readCookieHeader(carrier, nameFor(carrier.hostname)),

    /**
     * Does this request need a token at all?
     *
     * Two requests can never be forged into, whatever they are reaching, and neither is ever asked:
     *
     * - a **safe method**, which changes nothing;
     * - one presenting **`Authorization: Bearer`** — a cross-origin page cannot set that header without a
     *   preflight this server would have to allow, so requiring a token would break every API client to protect
     *   nobody.
     *
     * After that it depends on what the flow does, which is what `subject` says — an action taken as somebody is
     * protected by the session cookie's presence, a sign-in by where the request came from. See {@link CsrfSubject}.
     */
    required: (carrier: CsrfCarrier, subject: CsrfSubject = 'write'): boolean => {
      if (SAFE_METHODS.has((carrier.method ?? 'GET').toUpperCase()) || header(carrier, 'authorization')) {
        return false;
      }

      // The flow checks the caller's origin itself, against something narrower than anything here.
      if (subject === 'delegated') {
        return false;
      }

      if (subject === 'signIn') {
        /**
         * Not "is there a session cookie". A sign-in does not act on the session the request carries — it
         * REPLACES it — so a browser still holding a stale one was being refused the very request that fixes
         * that. What matters is whether another site caused this.
         */
        return foreign(carrier);
      }

      return readCookieHeader(carrier, sessionCookieParams(carrier.hostname, cookie).name) !== undefined;
    },

    /**
     * The whole check. The echoed token must verify against the session the request carries, and — when the
     * cookie is also present — match it. The second half costs nothing and blocks a token that leaked somewhere
     * the cookie did not.
     */
    verify: (carrier: CsrfCarrier, sessionToken?: string): CsrfResult => {
      const field = (carrier.body as Record<string, unknown> | undefined)?.[FIELD_NAME];
      const echoed = header(carrier, HEADER_NAME) ?? (typeof field === 'string' ? field : undefined);

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
