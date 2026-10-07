import { randomUUID } from 'node:crypto';

import { PLUGIN_ROUTES_SEGMENT } from '@plitzi/sdk-shared/actions/functions';

import { answerCall, readCall, responseOf, wireRequestOf, wireResponseFrom } from './capabilities';
import { functionLimitsFor } from './config';
import { functionContextFor } from './context';
import { parseRouteKey, reservedRouteProblem } from './manifest';
import { FunctionFailure } from './protocol';
import { pluginOfPath } from './scope';
import { serverLog } from '../../helpers/serverLog';
import { isActionRefusal } from '../actions/runtime/errors';

import type { FunctionsConfig } from './config';
import type { FunctionContext, FunctionRoute, FunctionsDefinition } from './contract';
import type { RouteKey } from './manifest';
import type { FunctionUsage, SpaceFunctions } from './protocol';
import type { FunctionScope } from './scope';
import type { TaskContextSource } from '../actions/runtime/runAction';
import type { Environment, SpaceRevision, SSRUser } from '@plitzi/sdk-shared';

/** Who is asking a route, as the transport knows them. */
export type RouteVisit = {
  spaceId: number;
  environment: Environment;
  at?: SpaceRevision;
  user?: SSRUser;
  /** `user:<id>` or `ip:<address>`, as for an action call. */
  callerId: string;
  signal: AbortSignal;
};

export type RouteHandler = { key: string; handle: (request: Request) => Promise<Response> };

/** A route key's params from a path it answers, or nothing when it does not answer it. */
const matchKey = (key: RouteKey, method: string, path: string): Record<string, string> | undefined => {
  const segments = path.replace(/^\/+/, '').split('/');
  if (key.method !== method || segments.length !== key.segments.length) {
    return undefined;
  }

  const params: Record<string, string> = {};
  for (const [index, expected] of key.segments.entries()) {
    let actual: string;
    try {
      actual = decodeURIComponent(segments[index] ?? '');
    } catch {
      return undefined;
    }

    if (expected.startsWith(':')) {
      if (!actual) {
        return undefined;
      }

      params[expected.slice(1)] = actual;
    } else if (expected !== actual) {
      return undefined;
    }
  }

  return params;
};

/** The first of `keys` that answers the request, with its params — declared order, as a space reads them. */
export const matchRoute = (
  keys: readonly string[],
  method: string,
  path: string
): { key: string; params: Record<string, string> } | undefined => {
  for (const key of keys) {
    const parsed = parseRouteKey(key);
    const params = parsed ? matchKey(parsed, method, path) : undefined;
    if (params) {
      return { key, params };
    }
  }

  return undefined;
};

/**
 * What of a visitor's request a function sees: everything but their credentials. The session cookie and any bearer
 * are the platform's — `ctx.user` says who is asking — and a function holding them could spend them anywhere its
 * hosts reach.
 */
const withoutCredentials = (request: Request): Request => {
  const headers = new Headers(request.headers);
  ['cookie', 'authorization', 'proxy-authorization'].forEach(name => headers.delete(name));
  [...headers.keys()].filter(name => name.startsWith('x-plitzi-')).forEach(name => headers.delete(name));

  return new Request(request, { headers });
};

/** What of a function's answer reaches the visitor: everything but cookies — the host's cookies are the platform's. */
const withoutCookies = (response: Response): Response => {
  const headers = new Headers(response.headers);
  headers.delete('set-cookie');

  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};

/**
 * A route that refused, threw or was stopped. A refusal's message was written for the visitor, who gets it with a 400;
 * of anything else the visitor gets that it failed, and the server's log gets why.
 */
const failed = (visit: RouteVisit, key: string, error: unknown): Response => {
  if (isActionRefusal(error) || (error instanceof FunctionFailure && error.reason === 'refused')) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  serverLog.error('Functions', `route ${key} of space ${String(visit.spaceId)} failed`, error);
  const stopped = error instanceof FunctionFailure && error.reason !== 'error';

  return Response.json(
    { error: stopped ? 'This route ran out of what it may spend' : 'This route failed' },
    { status: stopped ? 503 : 500 }
  );
};

export type RouteSources = {
  config: FunctionsConfig;
  /** The plugins' server halves this server ships, as they are now — a development server replaces them as they change. */
  plugins?: () => ReadonlyMap<string, FunctionsDefinition>;
  getFunctions?: (spaceId: number, at?: SpaceRevision) => Promise<SpaceFunctions | undefined>;
  getPluginFunctions?: (spaceId: number, at?: SpaceRevision) => Promise<Record<string, SpaceFunctions> | undefined>;
  taskContext: TaskContextSource;
};

type NativeRoute = { key: string; handler: FunctionRoute; hosts: readonly string[] };

/** A definition's routes, as a table this process answers from. */
const routesOf = (definition: FunctionsDefinition): NativeRoute[] =>
  Object.entries(definition.routes ?? {}).map(([key, handler]) => ({
    key,
    handler,
    hosts: definition.allow?.hosts ?? []
  }));

/**
 * The route a request reaches, if one does: under `/plugins/<type>/`, that plugin's — this server's own, then the one
 * the space's plugin brought; anywhere else, the deployment's own (its native functions') first, then the space's. Each
 * runs with the same context a task of theirs gets, `trigger: 'route'` — a plugin's with a plugin's narrower one.
 */
export const createRoutes = ({
  config,
  plugins = () => new Map(Object.entries(config.plugins ?? {})),
  getFunctions,
  getPluginFunctions,
  taskContext
}: RouteSources) => {
  const native = (config.native ?? []).flatMap(routesOf);
  // `/fn/plugins/` is where plugins answer: a deployment route there would be one no plugin could ever reach past.
  const reserved = native.find(route => parseRouteKey(route.key)?.segments[0] === PLUGIN_ROUTES_SEGMENT);
  if (reserved) {
    throw new Error(`[Functions] ${reservedRouteProblem(reserved.key)}`);
  }

  const contextOf = (
    visit: RouteVisit,
    key: string,
    hosts: readonly string[],
    scope?: FunctionScope
  ): FunctionContext => {
    const runId = randomUUID();
    const ctx = taskContext(
      {
        runId,
        spaceId: visit.spaceId,
        environment: visit.environment,
        trigger: 'call',
        callerId: visit.callerId,
        ...(visit.user ? { user: visit.user } : {}),
        ...(visit.at ? { at: visit.at } : {})
      },
      visit.signal,
      [`route:${key}`]
    );

    return {
      ...functionContextFor(
        {
          ...ctx,
          log: line => {
            serverLog.info('Functions', `route ${key} of space ${String(visit.spaceId)}: ${line}`);
          }
        },
        hosts,
        scope
      ),
      trigger: 'route'
    };
  };

  /** A route of code this process loaded: the deployment's own, or the server half of a plugin it ships. */
  const loadedRoute = (
    routes: readonly NativeRoute[],
    visit: RouteVisit,
    method: string,
    path: string,
    scope?: FunctionScope
  ): RouteHandler | undefined => {
    const match = matchRoute(
      routes.map(route => route.key),
      method,
      path
    );
    const route = match ? routes.find(entry => entry.key === match.key) : undefined;
    if (!match || !route) {
      return undefined;
    }

    const { handler } = route;

    return {
      key: match.key,
      handle: async request => {
        try {
          return withoutCookies(
            await handler(withoutCredentials(request), {
              ...contextOf(visit, match.key, route.hosts, scope),
              params: match.params
            })
          );
        } catch (error) {
          return failed(visit, match.key, error);
        }
      }
    };
  };

  /** A route of code the runner runs: the space's own, or the server half of a plugin it uses. */
  const runnerRoute = (
    functions: SpaceFunctions | undefined,
    visit: RouteVisit,
    method: string,
    path: string,
    scope?: FunctionScope
  ): RouteHandler | undefined => {
    const runner = functions?.runner ?? config.runner;
    const match = functions ? matchRoute(functions.manifest.routes, method, path) : undefined;
    if (!runner || !functions || !match) {
      return undefined;
    }

    // What the usage record calls it: a plugin's route says whose it is.
    const usageName = scope ? `plugin ${scope.plugin} route ${match.key}` : `route ${match.key}`;

    return {
      key: match.key,
      handle: async request => {
        const refusal = await config.admit?.(visit.spaceId);
        if (refusal) {
          return Response.json({ error: refusal }, { status: 429 });
        }

        const fnCtx = contextOf(visit, match.key, functions.manifest.hosts, scope);
        let ok = false;
        let spent: FunctionUsage | undefined;
        try {
          const value = await runner.invoke({
            bundle: functions.bundle,
            invocation: {
              kind: 'route',
              key: match.key,
              params: match.params,
              request: await wireRequestOf(withoutCredentials(request)),
              context: {
                spaceId: fnCtx.spaceId,
                environment: fnCtx.environment,
                runId: fnCtx.runId,
                trigger: fnCtx.trigger,
                callerId: fnCtx.callerId,
                ...(fnCtx.user ? { user: fnCtx.user } : {})
              }
            },
            limits: functionLimitsFor(config.limits, functions.limits, functions.manifest.limits),
            answer: call => answerCall(fnCtx, readCall(call)),
            signal: visit.signal,
            onUsage: usage => {
              spent = usage;
            }
          });
          ok = true;

          return withoutCookies(responseOf(wireResponseFrom(value)));
        } catch (error) {
          return failed(visit, match.key, error);
        } finally {
          if (spent) {
            config.onUsage?.({ spaceId: visit.spaceId, task: usageName, ok, usage: spent });
          }
        }
      }
    };
  };

  const pluginRoute = async (
    visit: RouteVisit,
    method: string,
    { plugin, path }: { plugin: string; path: string }
  ): Promise<RouteHandler | undefined> => {
    const scope = { plugin };
    const own = plugins().get(plugin);
    if (own) {
      return loadedRoute(routesOf(own), visit, method, path, scope);
    }

    const brought = (await getPluginFunctions?.(visit.spaceId, visit.at))?.[plugin];

    return runnerRoute(brought, visit, method, path, scope);
  };

  return {
    /** The route that answers `method path` (the path after `/fn`), for this visit — or none. */
    routeFor: async (visit: RouteVisit, method: string, path: string): Promise<RouteHandler | undefined> => {
      const addressed = pluginOfPath(path);
      if (addressed) {
        return pluginRoute(visit, method, addressed);
      }

      return (
        loadedRoute(native, visit, method, path) ??
        runnerRoute(await getFunctions?.(visit.spaceId, visit.at), visit, method, path)
      );
    }
  };
};
