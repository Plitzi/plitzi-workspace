import { randomUUID } from 'node:crypto';

import { answerCall, readCall, responseOf, wireRequestOf, wireResponseFrom } from './capabilities';
import { functionLimitsFor } from './config';
import { functionContextFor } from './context';
import { parseRouteKey } from './manifest';
import { FunctionFailure } from './protocol';
import { serverLog } from '../../helpers/serverLog';
import { ActionRefusal } from '../actions/runtime/errors';

import type { FunctionsConfig } from './config';
import type { FunctionContext, FunctionRoute, FunctionsDefinition } from './contract';
import type { RouteKey } from './manifest';
import type { FunctionUsage, SpaceFunctions } from './protocol';
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
  if (error instanceof ActionRefusal || (error instanceof FunctionFailure && error.reason === 'refused')) {
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
  getFunctions?: (spaceId: number, at?: SpaceRevision) => Promise<SpaceFunctions | undefined>;
  taskContext: TaskContextSource;
};

/**
 * The route a request reaches, if one does: the deployment's own (its native functions') first, then the space's —
 * each run with the same context a task of theirs gets, `trigger: 'route'`.
 */
export const createRoutes = ({ config, getFunctions, taskContext }: RouteSources) => {
  const native = (config.native ?? []).flatMap((definition: FunctionsDefinition) =>
    Object.entries(definition.routes ?? {}).map(([key, handler]) => ({
      key,
      handler,
      hosts: definition.allow?.hosts ?? []
    }))
  );

  const contextOf = (visit: RouteVisit, key: string, hosts: readonly string[]): FunctionContext => {
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
        hosts
      ),
      trigger: 'route'
    };
  };

  const nativeRoute = (visit: RouteVisit, method: string, path: string): RouteHandler | undefined => {
    const match = matchRoute(
      native.map(route => route.key),
      method,
      path
    );
    const route = match ? native.find(entry => entry.key === match.key) : undefined;
    if (!match || !route) {
      return undefined;
    }

    const handler: FunctionRoute = route.handler;

    return {
      key: match.key,
      handle: async request => {
        try {
          return withoutCookies(
            await handler(withoutCredentials(request), {
              ...contextOf(visit, match.key, route.hosts),
              params: match.params
            })
          );
        } catch (error) {
          return failed(visit, match.key, error);
        }
      }
    };
  };

  const spaceRoute = async (visit: RouteVisit, method: string, path: string): Promise<RouteHandler | undefined> => {
    const functions = await getFunctions?.(visit.spaceId, visit.at);
    const runner = functions?.runner ?? config.runner;
    const match = functions ? matchRoute(functions.manifest.routes, method, path) : undefined;
    if (!runner || !functions || !match) {
      return undefined;
    }

    return {
      key: match.key,
      handle: async request => {
        const refusal = await config.admit?.(visit.spaceId);
        if (refusal) {
          return Response.json({ error: refusal }, { status: 429 });
        }

        const fnCtx = contextOf(visit, match.key, functions.manifest.hosts);
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
            config.onUsage?.({ spaceId: visit.spaceId, task: `route ${match.key}`, ok, usage: spent });
          }
        }
      }
    };
  };

  return {
    /** The route that answers `method path` (the path after `/fn`), for this visit — or none. */
    routeFor: async (visit: RouteVisit, method: string, path: string): Promise<RouteHandler | undefined> =>
      nativeRoute(visit, method, path) ?? (await spaceRoute(visit, method, path))
  };
};
