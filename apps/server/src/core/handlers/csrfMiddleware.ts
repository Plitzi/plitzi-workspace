import { carrierOf, csrfFailureMessage } from '../auth/csrf';

import type { AuthedRequest, JsonResponse } from './types';
import type { Csrf } from '../auth/csrf';
import type { SessionCookies } from '../auth/session';

export interface CsrfMiddlewareOptions {
  /** Paths this deployment answers that must not be asked for a token — a payment gateway's webhook, say. */
  exempt?: (path: string) => boolean;
  /** `message` on some APIs, `error` on others. Matches whatever the rest of the deployment answers with. */
  errorKey?: 'message' | 'error';
}

/**
 * The CSRF check as middleware, for a deployment with a router.
 *
 * No framework is imported and none is assumed: it reads the handful of properties `AuthedRequest` describes, so
 * an Express, Connect or Koa request satisfies it unchanged. Mount it after whatever parses bodies and cookies —
 * a token posted in a form field cannot be read before the body is.
 *
 * A webhook is the case worth thinking about: it is a cross-site POST by design, it authenticates with a signature
 * rather than a cookie, and it will never carry a token. Exempt it by path.
 */
export const createCsrfMiddleware =
  (csrf: Csrf, cookies: SessionCookies, { exempt, errorKey = 'message' }: CsrfMiddlewareOptions = {}) =>
  (req: AuthedRequest, res: JsonResponse, next: () => void): void => {
    if (exempt?.(req.path) || !csrf.required(carrierOf(req))) {
      next();

      return;
    }

    const result = csrf.verify(carrierOf(req), cookies.resolveSessionToken(req));
    if (result.ok) {
      next();

      return;
    }

    res.status(403).json({ [errorKey]: csrfFailureMessage[result.reason], reason: result.reason });
  };

export interface OriginGuardOptions {
  /**
   * Origins this request may also come from, beyond the deployment's own — the ones the space credential it carries
   * declares. `true` for a credential that declares any origin at all.
   */
  allowedFor?: (req: AuthedRequest) => readonly string[] | true | undefined;
  /** Paths never guarded. A webhook carries no session cookie and is never refused anyway; this is for the rest. */
  exempt?: (path: string) => boolean;
  errorKey?: 'message' | 'error';
}

/**
 * Cross-site request forgery refused by ORIGIN, for a router whose cookie-carried writes do not all send a token.
 *
 * A write is refused when a session COOKIE could have authenticated it (an unsafe method, no `Authorization`, the
 * cookie present) and a browser says another site caused it — Fetch Metadata first, `Origin` exactly otherwise (see
 * `Csrf.crossSite`). The deployment's own origins pass, and so do the ones a space credential on the request declares:
 * a published site calling its own space is not forging anything. A client that is not a browser sends neither header
 * and passes, as does anything with a bearer — neither has a victim's cookie to borrow.
 *
 * This is the guard OWASP calls Fetch Metadata / origin verification. It is what a token is for, without a token: the
 * difference is only which clients can satisfy it, and every legitimate one here already does.
 */
export const createOriginGuardMiddleware =
  (csrf: Csrf, { allowedFor, exempt, errorKey = 'message' }: OriginGuardOptions = {}) =>
  (req: AuthedRequest, res: JsonResponse, next: () => void): void => {
    if (exempt?.(req.path) || !csrf.required(carrierOf(req))) {
      next();

      return;
    }

    const allowed = allowedFor?.(req);
    if (allowed === true || !csrf.crossSite(carrierOf(req), allowed ?? [])) {
      next();

      return;
    }

    res.status(403).json({ [errorKey]: csrfFailureMessage.foreign, reason: 'foreign' });
  };
