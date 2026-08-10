import { applySessionOutcome, authRoutes } from '../auth/routes';

import type { AuthedRequest, JsonResponse, HttpRoute, RouterLike } from './types';
import type { AuthApi } from '../auth/api';
import type { AuthRequest } from '../auth/routes';
import type { SessionCookies } from '../auth/session';

export interface AuthRouteHandlersOptions {
  api: AuthApi;
  cookies: SessionCookies;
  /** Reports a flow that threw. Without it the failure goes to `console.error`; the caller still gets a 500. */
  onError?: (error: unknown, context: { method: string; path: string }) => void;
}

/**
 * Built field by field rather than spread: on several frameworks `hostname` is a getter on the request prototype,
 * and a spread copies own properties only — it would arrive undefined, and every cookie would then be named for
 * nowhere. The kind of thing that is obvious once and costs an afternoon otherwise, which is why it is stated here
 * rather than left for each deployment to rediscover.
 */
const carrier = (req: AuthedRequest): AuthRequest => ({
  headers: req.headers,
  hostname: req.hostname,
  cookies: req.cookies,
  query: req.query,
  body: req.body,
  actor: req.user
});

/**
 * The whole `/auth` surface as request handlers: signing in and out, renewing, who-am-I, revoking every session,
 * and whichever of signup and password reset the deployment's adapters offer.
 *
 * The kernel answers these as *outcomes* — a body, a status, what should happen to the session — because it has no
 * idea what any deployment runs behind. Turning an outcome into an HTTP answer is the same everywhere, and every
 * deployment wrote the same loop for it. Doing what the outcome says about the cookies is the part worth not
 * rewriting: writing the session but not its readable hint is the failure that looks like a session which exists
 * and then does not.
 *
 * A list, so nothing has to be a router. On a bare `node:http` server, dispatch it yourself:
 *
 * ```ts
 * const routes = createAuthRouteHandlers({ api: auth.api, cookies: auth.cookies });
 * const route = routes.find(r => r.method === req.method && `/auth${r.path}` === url.pathname);
 * await route?.handle(request, response);
 * ```
 *
 * With a router, {@link mountAuthRoutes} is that same loop already written.
 *
 * Which flows actually answer is decided by the adapters, not here — no `createAccount`, no signup, and the route
 * reports 404 rather than failing at runtime. Mounting all of them is correct for a deployment that offers three.
 */
export const createAuthRouteHandlers = ({ api, cookies, onError }: AuthRouteHandlersOptions): HttpRoute[] =>
  authRoutes({ api, cookies }).map(({ method, path, handler }) => ({
    method,
    path,
    handle: async (req: AuthedRequest, res: JsonResponse): Promise<void> => {
      try {
        const outcome = await handler(carrier(req));

        applySessionOutcome(req, res, outcome, cookies);
        res.status(outcome.ok ? (outcome.status ?? 200) : outcome.status).json(outcome.body);
      } catch (error: unknown) {
        if (onError) {
          onError(error, { method, path });
        } else {
          console.error(`[auth] ${method} ${path} failed:`, error);
        }

        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }));

/**
 * {@link createAuthRouteHandlers}, hung on anything with `get` and `post`.
 *
 * ```ts
 * const router = Router();
 * mountAuthRoutes(router, { api: auth.api, cookies: auth.cookies });
 * app.use('/auth', router);
 * ```
 */
export const mountAuthRoutes = (router: RouterLike, options: AuthRouteHandlersOptions): void => {
  for (const { method, path, handle } of createAuthRouteHandlers(options)) {
    if (method === 'GET') {
      router.get(path, handle);
    } else {
      router.post(path, handle);
    }
  }
};
