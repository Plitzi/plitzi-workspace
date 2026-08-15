import type { HttpRoute, RouterLike, SocialRouteHandler } from './types';
import type { SocialAuth } from '../auth/oauth';
import type { SessionCookies } from '../auth/session';
import type { SSRSession } from '@plitzi/sdk-shared';

export interface SocialRouteHandlersOptions {
  /** A `createSocialAuth(...)` result — the providers this deployment has credentials for. */
  social: SocialAuth;
  /** Writes the session at the end of a successful callback, and holds the flow state between the two legs. */
  cookies: SessionCookies;
  /**
   * Mints the session for the account that just signed in. `auth.api.issueSession` is the one to pass: the flow
   * proves WHO, and what a session is worth is the kernel's answer, not the provider's.
   */
  issueSession: (userId: number) => Promise<SSRSession>;
  /** Reports a callback that threw. Without it the failure goes to `console.error`; the caller still gets a 500. */
  onError?: (error: unknown, context: { method: string; path: string }) => void;
}

/**
 * A provider id from the request.
 *
 * `params` when the host filled it in (Express does, from the `:provider` segment) and the path otherwise, so a
 * framework that does not populate params — or a bare `node:http` dispatch — needs nothing extra. The path form
 * reads the segment before the trailing action, which is where both routes carry it.
 */
const providerOf = (req: { params?: Record<string, string | undefined>; path: string }): string => {
  const fromParams = req.params?.provider;
  if (fromParams) {
    return fromParams;
  }

  const segments = req.path.split('/').filter(Boolean);

  return segments.length >= 2 ? segments[segments.length - 2] : '';
};

/**
 * Social sign-in as request handlers: the provider listing, and the two legs of the authorization-code flow.
 *
 * The counterpart to {@link createAuthRouteHandlers}, and it exists for the same reason. `createSocialAuth` already
 * answers the whole flow — where to send the browser, what state to hold, whether the caller came back with anything
 * worth a session — and every deployment then wrote the identical fifty lines that turn those answers into
 * redirects: set the flow cookie, clear it on the way back, decide that a failure with no vetted target has nowhere
 * to report to, write the session cookies before the final redirect. None of that is a deployment's own policy, and
 * two of the steps are the kind that look right while being wrong (clearing the flow cookie only on success leaves a
 * stale nonce; redirecting to an unvetted target is an open redirect).
 *
 * What stays the deployment's is what it already was: which providers it has credentials for, and what
 * `linkAccount` does with the person who comes back.
 *
 * A list, so nothing has to be a router — {@link mountSocialAuthRoutes} is the loop that hangs it on one. Mount it
 * on the same base as the `/auth` flows: the paths are `/providers` and `/<provider>/{login,callback}`.
 */
export const createSocialAuthRouteHandlers = ({
  social,
  cookies,
  issueSession,
  onError
}: SocialRouteHandlersOptions): HttpRoute<SocialRouteHandler>[] => {
  const report = (error: unknown, context: { method: string; path: string }): void => {
    if (onError) {
      onError(error, context);

      return;
    }

    console.error(`[auth] ${context.method} ${context.path} failed:`, error);
  };

  return [
    {
      method: 'GET',
      path: '/providers',
      // Exactly the buttons that will work: a provider with no credentials configured is not registered, so a
      // front-end cannot offer one that would dead-end.
      handle: (_req, res) => {
        res.status(200).json({ providers: social.list() });

        return Promise.resolve();
      }
    },
    {
      method: 'GET',
      path: '/:provider/login',
      handle: (req, res) => {
        const started = social.start(providerOf(req), req.query?.redirect);
        if (!started) {
          res.status(404).json({ error: 'Unknown provider' });

          return Promise.resolve();
        }

        cookies.writeFlow(req, res, started.stateCookie, started.ttl);
        res.redirect(started.redirectTo);

        return Promise.resolve();
      }
    },
    {
      method: 'GET',
      path: '/:provider/callback',
      handle: async (req, res) => {
        const providerId = providerOf(req);
        try {
          const { code, state, error } = (req.query ?? {}) as { code?: string; state?: string; error?: string };
          const stateCookie = cookies.readFlow(req);
          // Cleared before the outcome is known, not after a success: the nonce is single-use, and one left behind
          // by a failed attempt is a nonce a later attempt can be made to accept.
          cookies.clearFlow(req, res);

          const result = await social.complete(providerId, { code, state, error, stateCookie });

          if (!result.ok) {
            // Without a vetted redirect target there is nowhere safe to report to, so the failure ends here rather
            // than being bounced to wherever the caller asked.
            if (!result.redirectTo) {
              res.status(400).json({ error: result.error });

              return;
            }

            if (result.reason === 'server_error') {
              report(new Error(result.error), { method: 'GET', path: `/${providerId}/callback` });
            }

            res.redirect(result.redirectTo);

            return;
          }

          cookies.write(req, res, await issueSession(result.account.id));
          res.redirect(result.redirectTo);
        } catch (error: unknown) {
          report(error, { method: 'GET', path: `/${providerId}/callback` });
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    }
  ];
};

/** {@link createSocialAuthRouteHandlers}, hung on a router. Mount it wherever the `/auth` flows are mounted. */
export const mountSocialAuthRoutes = (
  router: RouterLike<SocialRouteHandler>,
  options: SocialRouteHandlersOptions
): void => {
  for (const route of createSocialAuthRouteHandlers(options)) {
    router.get(route.path, route.handle);
  }
};
