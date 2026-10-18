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
   * Origins that count as this deployment's own, beyond the request's own origin.
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

export type CsrfFailure = 'missing' | 'malformed' | 'expired' | 'mismatch' | 'foreign';

export const csrfFailureMessage: Record<CsrfFailure, string> = {
  missing: 'A CSRF token is required',
  malformed: 'CSRF token malformed',
  expired: 'CSRF token expired',
  mismatch: 'CSRF token does not match this session',
  foreign: 'A request from another origin may not act with this session'
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

/**
 * The carrier, read off whatever request a host hands over — named field by field, never spread.
 *
 * A spread copies OWN properties, and on Node's `IncomingMessage` (which an Express request is) `headers` is a getter on
 * the prototype: `{ ...req }` arrives with no headers at all, and the first header read throws. Every guard built on a
 * spread failed that way on every request.
 */
export const carrierOf = (
  req: { method?: string; headers: CsrfCarrier['headers']; hostname: string; cookies?: unknown; body?: unknown },
  method: string | undefined = req.method
): CsrfCarrier => ({
  method,
  headers: req.headers,
  hostname: req.hostname,
  ...(req.cookies && typeof req.cookies === 'object' ? { cookies: req.cookies as Record<string, string> } : {}),
  body: req.body
});

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

/**
 * Whether `origin` is the request's own: its host and port, as the `Host` header names them. When a proxy rewrote
 * `Host` (it no longer names the hostname the request is answered as), the hostname alone is what is left to compare.
 */
const isOwnOrigin = (origin: string, carrier: CsrfCarrier): boolean => {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    // `null` — a sandboxed iframe, a `data:` document. Not an origin, and deliberately not one anything may allow.
    return false;
  }

  const host = header(carrier, 'host');
  if (host === undefined) {
    return url.hostname === carrier.hostname;
  }

  let own: URL;
  try {
    // Read with the origin's scheme, so a default port written out (`acme.test:443`) is the one the origin omits.
    own = new URL(`${url.protocol}//${host}`);
  } catch {
    return false;
  }

  return own.hostname === carrier.hostname ? url.host === own.host : url.hostname === carrier.hostname;
};

/**
 * Did a page of another ORIGIN cause this request — `allowed` naming the origins this deployment counts as its own?
 *
 * This is what protects signing in, where there is no session to bind a token to and no cookie to look for, and
 * every write a page server answers, cookie or none (`crossSiteWritesStage`). It rests on two headers a page CANNOT
 * set — the browser attaches both, and script may not override either:
 *
 * - **`Sec-Fetch-Site`** is the browser's own account of where the request came from, and is believed first.
 *   `same-origin`, and `none` (a typed URL, a bookmark), are this server's own; `same-site` and `cross-site` are a
 *   page of another origin, foreign unless its origin was named.
 * - **`Origin`** is the fallback, for a browser too old to send the above — Safari only did from 16.4. Matched
 *   **exactly** — host and port; one port does not serve two schemes — against this host or an origin the deployment
 *   named.
 *
 * **`same-site` is not trusted, and was once.** A site is a registrable domain, with no port in it: another port of
 * this host, or a sibling sub-domain, is the same site. Both are where somebody else's code is served by design —
 * `createAuthoringHost` on a port of its own, every space of a platform on a sub-domain of one domain (two spaces at
 * `*.plitzi.app` are one site until that domain is on the public suffix list) — and trusting the site let any of them
 * write here as if they were this server's own pages. A sibling that IS this deployment's own is named, as it always
 * had to be in production, where the app and its spaces are on different sites: `createAuth` fills the list from
 * `identity.platformOrigins`, a page server from `crossSiteWrites.origins`.
 *
 * Nor is a domain boundary guessed: this once compared *registrable domains*, last-two-labels, and with no public
 * suffix list every other `.co.uk` counted as the same site as a deployment at `acme.co.uk`.
 *
 * **Neither header means this is not a browser**, and a client that is not a browser cannot be made to forge
 * anything: there is no victim's session sitting in it. That is what keeps every API client, mobile app and
 * script signing in with nothing extra to send.
 */
export const crossSiteRequest = (carrier: CsrfCarrier, allowed: (origin: string) => boolean = () => false): boolean => {
  const site = header(carrier, 'sec-fetch-site');
  const origin = header(carrier, 'origin');
  const vouched = origin !== undefined && allowed(origin);

  if (site !== undefined) {
    // The browser has answered the question; anything but its own origin, or no page at all, is another's.
    return site !== 'same-origin' && site !== 'none' && !vouched;
  }

  if (!origin) {
    return false;
  }

  return !isOwnOrigin(origin, carrier) && !vouched;
};

export const createCsrf = (config: CsrfConfig) => {
  const { secret, cookie, allowedOrigins = [] } = config;

  const permitted = (origin: string): boolean =>
    typeof allowedOrigins === 'function' ? allowedOrigins(origin) : allowedOrigins.includes(origin);

  const foreign = (carrier: CsrfCarrier, alsoAllowed: readonly string[] = []): boolean =>
    crossSiteRequest(carrier, origin => permitted(origin) || alsoAllowed.includes(origin));

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
     * Whether a browser sent this from a site this deployment does not recognise — its own origins, and
     * `alsoAllowed` (the origins a SPACE declared, for a request that carries that space's credential).
     *
     * The rule `signIn` flows are guarded by, offered on its own for a router whose writes cannot all carry a token:
     * a cookie-carried write that a foreign page caused is refused by where it came from — see
     * `createOriginGuardMiddleware`. A request with neither Fetch Metadata nor `Origin` is not a browser's, and is
     * never foreign: there is no victim's session in a script.
     */
    crossSite: (carrier: CsrfCarrier, alsoAllowed?: readonly string[]): boolean => foreign(carrier, alsoAllowed),

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
