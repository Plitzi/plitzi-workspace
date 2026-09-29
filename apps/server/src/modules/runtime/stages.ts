import http from 'node:http';
import https from 'node:https';

import { endpointFor, endpointProblem } from './contract';
import { PLATFORM_HEADERS } from './host';
import { webRequestOf, writeWebResponse } from '../../core/http/webExchange';
import { clientIp, requestOrigin } from '../../core/requestParser';

import type { SpaceRuntime, SpaceRuntimeContext, SpaceRuntimeEndpoint } from './contract';
import type { SSRContext, Stage } from '../../core/http/types';
import type { FunctionsDefinition } from '../functions/contract';

const originOf = (ctx: SSRContext): string => requestOrigin(ctx.req) || `${ctx.req.protocol}://${ctx.req.hostname}`;

/** A runtime's endpoints answered in this process — self-hosting — exactly as the platform forwards them to its own. */
export const runtimeEndpointsStage = (endpoints: Record<string, SpaceRuntimeEndpoint>): Stage<SSRContext> => {
  const paths = Object.keys(endpoints);
  const problems = paths.flatMap(path => endpointProblem(path) ?? []);
  if (problems.length > 0) {
    throw new Error(problems.join('; '));
  }

  return async ctx => {
    const endpoint = endpointFor(paths, ctx.req.path);
    const answer = endpoint ? endpoints[endpoint] : undefined;
    if (!endpoint || !answer) {
      return false;
    }

    ctx.operation = `endpoint ${endpoint}`;
    const request = await webRequestOf(ctx.raw, `${originOf(ctx)}${ctx.raw.url ?? ctx.req.path}`, PLATFORM_HEADERS);
    await writeWebResponse(ctx.rawRes, await answer(request), ctx.signal);

    return true;
  };
};

/** A runtime on a server of its own: what `createServer` is handed of it, and how to stop it. */
export type ServedRuntime = {
  /** Its tasks and routes, for `functions.native`. */
  native: FunctionsDefinition[];
  /** Its endpoints, for `preAuth` — they gate themselves, as the platform's forwarding does. */
  stage: Stage<SSRContext>;
  close: () => Promise<void>;
};

/**
 * A space runtime served by a self-hosted server instead of the platform: started here, its functions loaded natively
 * and its endpoints answered by a stage — the same module the platform runs as a runtime of the space.
 */
export const serveRuntime = async (runtime: SpaceRuntime, context: SpaceRuntimeContext): Promise<ServedRuntime> => {
  const parts = await runtime.start(context);

  return {
    native: parts.functions ? [parts.functions] : [],
    stage: runtimeEndpointsStage(parts.endpoints ?? {}),
    close: async () => {
      await parts.close?.();
    }
  };
};

/** Where a space's runtime is, for the page server to forward its endpoints to. */
export type RuntimeTarget = {
  /** Its base URL — `http://10.0.4.7:8791`. */
  url: string;
  /** What it is presented, as `Authorization: Bearer <secret>`. */
  secret: string;
  /** The paths it answers — what it described when it started. */
  endpoints: readonly string[];
};

export type RuntimeProxyConfig = {
  /** The runtime serving a space and environment — or none, for a space the platform serves alone. */
  lookup: (space: { spaceId: number; environment: string }) => Promise<RuntimeTarget | undefined>;
  /**
   * Told each time a request is forwarded to a space's runtime — not for every request of the space, most of which are
   * its pages: what counts as a runtime being used, for a deployment that stops the ones nobody uses.
   */
  onForward?: (space: { spaceId: number; environment: string; endpoint: string }) => void;
};

const HOP_BY_HOP = ['connection', 'keep-alive', 'transfer-encoding', 'upgrade'];

/** The query parameter a platform credential rides in (`credentials.ts`): never forwarded either. */
const PLATFORM_QUERY_CREDENTIAL = 'access-token';

/** Never forwarded to a runtime: one hop's, and the platform's — the visitor's session is not the runtime's to hold. */
const NOT_FORWARDED = new Set([...HOP_BY_HOP, ...PLATFORM_HEADERS, 'host']);

/** Never answered from one: the host's cookies are the platform's, as a function route's are. */
const NOT_ANSWERED = new Set([...HOP_BY_HOP, 'set-cookie']);

/**
 * The page server forwarding a space's endpoints to its runtime: the request as it came, streamed both ways — an agent's
 * event stream included — without the visitor's cookies or `Authorization`, and with who asked in `X-Forwarded-*`.
 *
 * A data stage: after the auth chain, so the space is known, and before the space's `/api/` routes and its pages.
 */
export const createRuntimeProxyStage =
  ({ lookup, onForward }: RuntimeProxyConfig): Stage<SSRContext> =>
  async ctx => {
    const { spaceId, environment = 'main' } = ctx.req.ctx.spaceDeployment ?? {};
    if (typeof spaceId !== 'number') {
      return false;
    }

    const target = await lookup({ spaceId, environment });
    const endpoint = target ? endpointFor(target.endpoints, ctx.req.path) : undefined;
    if (!target || !endpoint) {
      return false;
    }

    ctx.operation = `runtime ${endpoint}`;
    onForward?.({ spaceId, environment, endpoint });
    const headers: http.OutgoingHttpHeaders = {};
    Object.entries(ctx.raw.headers).forEach(([name, value]) => {
      if (!name.startsWith(':') && !NOT_FORWARDED.has(name) && value !== undefined) {
        headers[name] = value;
      }
    });
    headers.authorization = `Bearer ${target.secret}`;
    headers['x-forwarded-host'] = ctx.req.hostname;
    headers['x-forwarded-proto'] = ctx.req.protocol;
    headers['x-forwarded-for'] = clientIp(ctx.raw, ctx.req);

    const url = new URL(ctx.raw.url ?? ctx.req.path, target.url);
    // A credential of the platform's can ride in the query too — a builder preview's — and is no more the runtime's.
    url.searchParams.delete(PLATFORM_QUERY_CREDENTIAL);
    await new Promise<void>(resolve => {
      const upstream = (url.protocol === 'https:' ? https : http).request(url, { method: ctx.raw.method, headers });
      const unreachable = (): void => {
        if (!ctx.rawRes.headersSent) {
          ctx.rawRes.writeHead(502, { 'content-type': 'application/json' });
          ctx.rawRes.end(JSON.stringify({ error: 'This space’s runtime is not answering' }));
        } else {
          ctx.rawRes.end();
        }

        resolve();
      };
      ctx.signal.addEventListener('abort', () => upstream.destroy(), { once: true });
      upstream.on('error', unreachable);
      upstream.on('response', answer => {
        const answered: Record<string, string | string[]> = {};
        Object.entries(answer.headers).forEach(([name, value]) => {
          if (!NOT_ANSWERED.has(name) && value !== undefined) {
            answered[name] = value;
          }
        });
        ctx.rawRes.writeHead(answer.statusCode ?? 502, answered);
        answer.on('data', (chunk: Buffer) => ctx.rawRes.write(chunk));
        answer.on('end', () => {
          ctx.rawRes.end();
          resolve();
        });
        answer.on('error', unreachable);
      });
      ctx.raw.pipe(upstream);
    });

    return true;
  };
