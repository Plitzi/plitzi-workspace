/** The Express binding for the auth kernel.
 *
 *  `@plitzi/sdk-server` does not depend on Express and must not start: the rules are transport-neutral so a
 *  deployment can put them behind anything. But almost everyone puts them behind Express, and writing the same
 *  ~200 lines of adapter is not a design choice anybody makes on purpose — it is a tax on running this at all.
 *
 *  So it lives here, behind its own entry point: import `@plitzi/sdk-server/express` and Express loads; import
 *  anything else and it never does. Nothing in this file decides anything — every decision below is the kernel's,
 *  and what is here is putting the answer on `req`, on the response, or on a router.
 */

import { Router } from 'express';

import { createAuthorizer } from './core/auth/authorize';
import {
  clearFlowCookie,
  clearSessionCookies,
  readFlowCookie,
  readRefreshToken,
  readSessionToken,
  writeFlowCookie,
  writeSessionCookies
} from './core/auth/session';
import { authFailureMessage } from './core/auth/tokens';

import type { AuthApi, AuthOutcome } from './core/auth/api';
import type { AuthPolicy } from './core/auth/authorize';
import type { Actor, Grant, Identity } from './core/auth/identity';
import type { SSRAuthCookie, SSRSession } from '@plitzi/sdk-shared';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * A request the guard has been through. Stated as an intersection rather than by augmenting `express-serve-static-core`
 * from here: a library that augments its consumer's globals only works when both resolve the identical copy of
 * `@types/express`, which under a workspace or PnP install they generally do not — the augmentation silently fails to
 * merge and every `req.user` in the consumer stops type-checking. Deployments declare it once, for their own code.
 */
export type AuthedRequest = Request & {
  /** The authenticated account, when the request carries a valid session. */
  user?: Actor;
  /** The space the request is addressed to, and what the bearer may do with it. */
  grant?: Grant;
};

/**
 * What this deployment calls its cookies. Everything else about them — lifetime, `SameSite`, the readable hint beside
 * the session, clearing both together — is the kernel's, and is why one writer serves the API and the renderer alike.
 */
export type CookieNaming = SSRAuthCookie;

/** Session and flow cookies over an Express request pair. */
export const createCookies = (config: CookieNaming) => ({
  setSession: (req: Request, res: Response, session: SSRSession): void =>
    writeSessionCookies(req, res, session, config),

  clearSession: (req: Request, res: Response): void => clearSessionCookies(req, res, config),

  /** Holds a social sign-in between its two legs: the CSRF nonce and the PKCE verifier. */
  setFlow: (req: Request, res: Response, value: string, ttlSeconds: number): void =>
    writeFlowCookie(req, res, value, ttlSeconds, config),

  clearFlow: (req: Request, res: Response): void => clearFlowCookie(req, res, config),

  readFlow: (req: Request): string | undefined => readFlowCookie(req, config),

  /**
   * The renewal credential from the body (`refresh_token`, for API clients) or its cookie (for browsers). The body
   * wins when both are present, mirroring how the access token is resolved.
   */
  resolveRefreshToken: (req: Request): string | undefined => {
    const bodyToken = (req.body as { refresh_token?: unknown } | undefined)?.refresh_token;

    if (typeof bodyToken === 'string' && bodyToken.trim() !== '') {
      return bodyToken.trim();
    }

    return readRefreshToken(req, config);
  },

  /** From `Authorization: Bearer` or the session cookie, so every endpoint accepts a bearer client and a browser. */
  resolveAuthToken: (req: Request): string | undefined => {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    return bearerToken ?? readSessionToken(req, config);
  }
});

export type Cookies = ReturnType<typeof createCookies>;

/**
 * The guard. Which paths need what, and whether a request carries it, is `createAuthorizer`'s and identical on every
 * transport; this puts the result on `req` and answers in the shape this deployment's clients expect.
 */
export const createAuthGuard =
  (identity: Identity, policy: AuthPolicy, { errorKey = 'message' }: { errorKey?: 'message' | 'error' } = {}) =>
  async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
    const result = await createAuthorizer(identity, policy)(req, req.path);

    if (!result.ok) {
      // The message is for a person, `reason` is for the client: it is what lets a browser tell "renew me" from
      // "you are gone", and therefore whether to refresh silently or drop to signed-out.
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

/**
 * A global capability, checked off the actor the guard already resolved — no query. This is the whole of RBAC that
 * applies outside a space: platform-wide routes rather than "may you touch this space", which is `identity.can()` and
 * needs the membership half too.
 */
export const requirePermission =
  (permission: string): RequestHandler =>
  (req: Request, res, next) => {
    const { user } = req as AuthedRequest;

    if (!user?.id) {
      res.status(401).json({ error: 'Not authenticated' });

      return;
    }

    if (!user.permissions.includes(permission)) {
      res.status(403).json({ error: 'Insufficient permissions' });

      return;
    }

    next();
  };

/** Sends what a kernel handler answered, doing what it says about the session cookies on the way out. */
export const sendOutcome = (req: Request, res: Response, outcome: AuthOutcome, cookies: Cookies): Response => {
  if (outcome.ok && outcome.session) {
    cookies.setSession(req, res, outcome.session);
  }

  if (outcome.ok && outcome.endSession) {
    cookies.clearSession(req, res);
  }

  return res.status(outcome.ok ? (outcome.status ?? 200) : outcome.status).json(outcome.body);
};

const body = (req: Request): Record<string, unknown> => (req.body ?? {}) as Record<string, unknown>;

/** A body field as a string, whatever arrived. Handlers validate what they need; this only stops `[object Object]`. */
const field = (req: Request, name: string): string => {
  const value = body(req)[name];

  return typeof value === 'string' ? value : '';
};

/**
 * The whole `/auth` surface as a router: call the handler, do what it says about the cookies, send the body. Which of
 * these routes actually answers is decided by the API itself — no adapter, no endpoint — so mounting all of them is
 * correct even for a deployment that offers three.
 */
export const createAuthRouter = ({ api, cookies }: { api: AuthApi; cookies: Cookies }): Router => {
  const router = Router();

  const handle =
    (run: (req: Request) => Promise<AuthOutcome> | AuthOutcome) =>
    async (req: Request, res: Response): Promise<Response> => {
      try {
        return sendOutcome(req, res, await run(req), cookies);
      } catch (error) {
        console.error(`${req.method} ${req.path} failed:`, error);

        return res.status(500).json({ error: 'Internal server error' });
      }
    };

  router.get(
    '/capabilities',
    handle(() => api.describe())
  );
  router.get(
    '/session',
    handle(req => api.session((req as AuthedRequest).user))
  );
  router.post(
    '/login',
    handle(req => api.login(body(req)))
  );
  router.post(
    '/refresh',
    handle(req => api.refresh(cookies.resolveRefreshToken(req)))
  );
  router.post(
    '/logout',
    handle(req =>
      api.logout({ accessToken: cookies.resolveAuthToken(req), refreshToken: cookies.resolveRefreshToken(req) })
    )
  );
  router.post(
    '/sessions/revoke',
    handle(req => api.revokeSessions((req as AuthedRequest).user?.id))
  );
  router.post(
    '/exchange',
    handle(req => api.exchange(field(req, 'provider'), field(req, 'token'), req))
  );
  router.post(
    '/signup',
    handle(req => api.signup(body(req)))
  );
  router.post(
    '/forgot-password',
    handle(req => api.forgotPassword(field(req, 'email')))
  );
  router.post(
    '/reset-password',
    handle(req => api.resetPassword(field(req, 'token'), field(req, 'password')))
  );
  router.post(
    '/validate-account',
    handle(req => api.validateAccount(field(req, 'token')))
  );
  router.post(
    '/resend-verification-email',
    handle(req => api.resendVerification(field(req, 'email')))
  );

  return router;
};
