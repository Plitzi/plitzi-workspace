import { randomUUID } from 'node:crypto';

import { serverLog } from '@plitzi/sdk-kernel/log';
import { PLUGIN_ROUTES_SEGMENT } from '@plitzi/sdk-shared/actions';
import { FunctionFailure, isFunctionLimit, isStreamedRouteAnswer } from '@plitzi/sdk-shared/functions';
import { isActionRefusal } from '@plitzi/sdk-shared/functions';
import { responseOf, wireRequestOf, wireResponseFrom } from '@plitzi/sdk-shared/functions';

import { answerCall, readCall } from './capabilities';
import { functionLimitsFor, functionSizeRefusal } from './config';
import { functionContextFor } from './context';
import { jobsManifestOf } from './jobs';
import { parseRouteKey, reservedRouteProblem } from './manifest';
import { OAUTH_CALLBACK_PATH, oauthCallback } from './oauth';
import { pluginOfPath } from './scope';

import type { FunctionsConfig } from './config';
import type { RouteKey } from './manifest';
import type { FunctionScope } from './scope';
import type { TaskContextSource } from '../engine/runtime/runAction';
import type {
  Environment,
  FunctionJobManifest,
  FunctionOAuthConnection,
  SpaceRevision,
  SSRUser
} from '@plitzi/sdk-shared';
import type { FunctionContext, FunctionRoute, FunctionsDefinition } from '@plitzi/sdk-shared/functions';
import type { FunctionUsage, SpaceFunctions } from '@plitzi/sdk-shared/functions';

/** Who is asking a route, as the transport knows them. */
export type RouteVisit = {
  spaceId: number;
  environment: Environment;
  at?: SpaceRevision;
  user?: SSRUser;
  /** `user:<id>` or `ip:<address>`, as for an action call. */
  callerId: string;
  /** The public origin the request reached (`https://shop.example.com`), as the server resolved it. */
  origin?: string;
  signal: AbortSignal;
};

/**
 * What a route answered, and whether it is written as it comes: a runtime's route and the deployment's own code may
 * stream, and are passed on as they are written; a sandbox's is whole, and sent as one.
 */
export type RouteAnswer = { response: Response; streamed: boolean };

export type RouteHandler = { key: string; handle: (request: Request) => Promise<RouteAnswer> };

const whole = (response: Response): RouteAnswer => ({ response, streamed: false });

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
 * A route that refused, threw or was stopped. A refusal's message was written for the visitor, who gets it with a 400.
 * A limit of its own is the code's to fix, and says which — asking again reaches it again, so never a 503, which tells a
 * caller to retry. A runner without room or out of reach is the platform's: a 503 to ask again in a moment. Of anything
 * else the visitor gets that it failed, and the server's log gets why.
 */
const failed = (visit: RouteVisit, key: string, error: unknown): Response => {
  if (isActionRefusal(error) || (error instanceof FunctionFailure && error.reason === 'refused')) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  serverLog.error('Functions', `route ${key} of space ${String(visit.spaceId)} failed`, error);
  if (error instanceof FunctionFailure && isFunctionLimit(error.reason)) {
    return Response.json({ error: `This route stopped at a limit its plan sets: ${error.message}` }, { status: 500 });
  }

  if (error instanceof FunctionFailure && (error.reason === 'busy' || error.reason === 'unreachable')) {
    return Response.json(
      { error: 'This route could not run right now: ask again in a moment' },
      { status: 503, headers: { 'retry-after': '1' } }
    );
  }

  // Of a size no runner here could ever hold: asking again changes nothing — the deployment's runners are too small.
  if (error instanceof FunctionFailure && error.reason === 'too_large') {
    return Response.json({ error: `This route could not run on this server: ${error.message}` }, { status: 500 });
  }

  // The runner went away while it ran the route: the platform's, said as such — a 502, since it may have run in part and
  // asking again is the caller's to judge.
  if (error instanceof FunctionFailure && error.reason === 'lost') {
    return Response.json(
      { error: 'The functions runner went away while it ran this route: it may have run in part' },
      { status: 502 }
    );
  }

  return Response.json({ error: 'This route failed' }, { status: 500 });
};

export type RouteSources = {
  config: FunctionsConfig;
  /** The plugins' server halves this server ships, as they are now — a development server replaces them as they change. */
  plugins?: () => ReadonlyMap<string, FunctionsDefinition>;
  getFunctions?: (spaceId: number, at?: SpaceRevision) => Promise<SpaceFunctions | undefined>;
  getPluginFunctions?: (spaceId: number, at?: SpaceRevision) => Promise<Record<string, SpaceFunctions> | undefined>;
  taskContext: TaskContextSource;
};

type NativeRoute = {
  key: string;
  handler: FunctionRoute;
  hosts: readonly string[];
  oauth?: Readonly<Record<string, FunctionOAuthConnection>>;
  jobs: Readonly<Record<string, FunctionJobManifest>>;
};

/** A definition's routes, as a table this process answers from. */
const routesOf = (definition: FunctionsDefinition): NativeRoute[] =>
  Object.entries(definition.routes ?? {}).map(([key, handler]) => ({
    key,
    handler,
    hosts: definition.allow?.hosts ?? [],
    ...(definition.oauth ? { oauth: definition.oauth } : {}),
    jobs: jobsManifestOf(definition)
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

  /** The run's own context for a request of this visit: the space's kv, its credentials, its key. */
  const runOf = (visit: RouteVisit, key: string) =>
    taskContext(
      {
        runId: randomUUID(),
        spaceId: visit.spaceId,
        environment: visit.environment,
        trigger: 'call',
        callerId: visit.callerId,
        ...(visit.user ? { user: visit.user } : {}),
        ...(visit.at ? { at: visit.at } : {}),
        ...(visit.origin ? { origin: visit.origin } : {})
      },
      visit.signal,
      [`route:${key}`]
    );

  const contextOf = (
    visit: RouteVisit,
    key: string,
    hosts: readonly string[],
    scope?: FunctionScope,
    oauth?: Readonly<Record<string, FunctionOAuthConnection>>,
    jobs?: Readonly<Record<string, FunctionJobManifest>>
  ): FunctionContext => {
    const ctx = runOf(visit, key);

    return {
      ...functionContextFor(
        {
          ...ctx,
          log: line => {
            serverLog.info('Functions', `route ${key} of space ${String(visit.spaceId)}: ${line}`);
          }
        },
        hosts,
        scope,
        oauth,
        jobs
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
          // The deployment's own code, in this process: whatever its Response holds is passed on as it is written.
          return {
            response: withoutCookies(
              await handler(withoutCredentials(request), {
                ...contextOf(visit, match.key, route.hosts, scope, route.oauth, route.jobs),
                params: match.params
              })
            ),
            streamed: true
          };
        } catch (error) {
          return whole(failed(visit, match.key, error));
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
          return whole(Response.json({ error: refusal }, { status: 429 }));
        }

        const fnCtx = contextOf(
          visit,
          match.key,
          functions.manifest.hosts,
          scope,
          functions.manifest.oauth,
          functions.manifest.jobs
        );
        let ok = false;
        let spent: FunctionUsage | undefined;
        // A route that streams has spent what it spent once its body ends, long after it answered.
        let streaming = false;
        const limits = functionLimitsFor(config.limits, functions.limits, functions.manifest.limits);
        const meter = (usage: FunctionUsage, done: boolean): void => {
          config.onUsage?.({ spaceId: visit.spaceId, task: usageName, ok: done, usage, memoryMb: limits.memoryMb });
        };
        try {
          // A size its plan does not include, refused before it runs: answered as the limit it is.
          const sizeRefusal = functionSizeRefusal(config.limits, functions.limits, functions.manifest.limits);
          if (sizeRefusal) {
            throw new FunctionFailure('memory', sizeRefusal);
          }

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
            limits,
            answer: call => answerCall(fnCtx, readCall(call)),
            signal: visit.signal,
            onUsage: usage => {
              if (streaming) {
                meter(usage, true);
              } else {
                spent = usage;
              }
            }
          });
          ok = true;
          if (isStreamedRouteAnswer(value)) {
            streaming = true;

            return {
              response: withoutCookies(
                new Response(value.body, { status: value.status, statusText: value.statusText, headers: value.headers })
              ),
              streamed: true
            };
          }

          return whole(withoutCookies(responseOf(wireResponseFrom(value))));
        } catch (error) {
          return whole(failed(visit, match.key, error));
        } finally {
          if (spent) {
            meter(spent, ok);
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
      // The visitor back from an OAuth provider: the platform's, whatever the space's code declared.
      if (method === 'GET' && path === OAUTH_CALLBACK_PATH) {
        return {
          key: `GET ${OAUTH_CALLBACK_PATH}`,
          handle: async request => {
            const run = runOf(visit, `GET ${OAUTH_CALLBACK_PATH}`);
            try {
              return whole(await oauthCallback(run, new URL(request.url).searchParams));
            } catch (error) {
              return whole(failed(visit, `GET ${OAUTH_CALLBACK_PATH}`, error));
            }
          }
        };
      }

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
