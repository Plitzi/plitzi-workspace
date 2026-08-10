/**
 * The auth kernel as ready-made request handlers. Import as `@plitzi/sdk-server/handlers`.
 *
 * **No framework is imported here, and none is assumed.** The request, response and router are described by the
 * handful of properties these functions touch (see `AuthedRequest`, `HandlerResponse`, `RouteSink`), so an Express,
 * Connect or Koa object satisfies them as it stands, and a bare `node:http` server satisfies them with a few lines
 * of its own. Tying this package to one framework would be the wrong trade — but so is leaving every deployment to
 * rediscover the same twenty lines, one of which has a real trap in it (`hostname` and spreads, see below).
 *
 * A deployment with a router:
 *
 * ```ts
 * import { createAuthGuard, mountAuthRoutes } from '@plitzi/sdk-server/handlers';
 *
 * app.use(createAuthGuard(auth.identity, policy));
 *
 * const router = Router();
 * mountAuthRoutes(router, { api: auth.api, cookies: auth.cookies });
 * app.use('/auth', router);
 * ```
 *
 * A deployment without one — `createAuthHandlers` is a list, and dispatching it is yours:
 *
 * ```ts
 * import { createAuthHandlers } from '@plitzi/sdk-server/handlers';
 *
 * const routes = createAuthHandlers({ api: auth.api, cookies: auth.cookies });
 *
 * http.createServer(async (raw, rawRes) => {
 *   const req = parseRequest(raw);              // from @plitzi/sdk-server/kernel
 *   const route = routes.find(r => r.method === req.method && `/auth${r.path}` === req.path);
 *   if (route) {
 *     await route.handle(req, jsonResponse(rawRes));
 *   }
 * });
 * ```
 *
 * Everything a deployment must decide — its accounts, its policy, its cookie naming — stays `createAuth`'s. What is
 * here is only what is the same for everyone.
 *
 * `req.user` and `req.grant` are what the guard resolved. To have those typed across your own routers, declare them
 * once in your app rather than expecting them from here — a library augmenting its consumer's globals only merges
 * when both resolve the identical copy of the framework's types, and two installs do not:
 *
 * ```ts
 * declare module 'express-serve-static-core' {
 *   interface Request {
 *     user?: Actor;
 *     grant?: Grant;
 *   }
 * }
 * ```
 */

export { createAuthGuard } from './core/handlers/guard';
export { createAuthHandlers, mountAuthRoutes } from './core/handlers/authRoutes';

export type { AuthGuardOptions } from './core/handlers/guard';
export type { AuthHandlersOptions } from './core/handlers/authRoutes';
export type { AuthedRequest, HandlerResponse, MountableRoute, RouteHandler, RouteSink } from './core/handlers/types';
