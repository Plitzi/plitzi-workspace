import { csrfFailureMessage } from '../auth/csrf';

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
    if (exempt?.(req.path) || !csrf.required({ ...req, method: req.method })) {
      next();

      return;
    }

    const result = csrf.verify(req, cookies.resolveSessionToken(req));
    if (result.ok) {
      next();

      return;
    }

    res.status(403).json({ [errorKey]: csrfFailureMessage[result.reason], reason: result.reason });
  };
