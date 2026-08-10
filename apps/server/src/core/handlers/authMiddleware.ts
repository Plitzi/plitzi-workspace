import { createAuthorizer } from '../auth/authorize';
import { authFailureMessage } from '../auth/tokens';

import type { AuthedRequest, JsonResponse } from './types';
import type { AuthPolicy } from '../auth/authorize';
import type { Identity } from '../auth/identity';

export interface AuthMiddlewareOptions {
  /**
   * Which key carries the human-readable refusal. `error` by convention; `message` for an API whose clients already
   * read that. Only the wording moves — `reason` is always beside it, because that is the half a client acts on.
   */
  errorKey?: 'error' | 'message';
}

/**
 * The authorizer, as middleware: `(req, res, next)`.
 *
 * The decision itself is `createAuthorizer` and is the same on every transport — that is why it lives a level down,
 * and why a host that has no middleware chain should call that instead. What is here is the binding: put what was
 * resolved onto the request so everything behind it can read `req.user` and `req.grant`, and answer a refusal in a
 * shape a client can act on.
 *
 * Both halves of that answer matter. The message is for a person reading a log; `reason` is for the browser, and it
 * is what separates "renew me" from "you are gone" — without it a client either signs people out on a hiccup or
 * retries a dead session forever.
 *
 * ```ts
 * app.use(createAuthMiddleware(auth.identity, policy));
 * ```
 */
export const createAuthMiddleware = (identity: Identity, policy: AuthPolicy, options: AuthMiddlewareOptions = {}) => {
  const { errorKey = 'error' } = options;
  const authorize = createAuthorizer(identity, policy);

  return async (req: AuthedRequest, res: JsonResponse, next: () => void): Promise<void> => {
    const result = await authorize(req, req.path);

    if (!result.ok) {
      res.status(result.status).json({ [errorKey]: authFailureMessage[result.reason], reason: result.reason });

      return;
    }

    if (result.actor) {
      req.user = result.actor;
    }

    if (result.grant) {
      req.grant = result.grant;
    }

    next();
  };
};
