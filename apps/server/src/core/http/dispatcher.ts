import { applySecurityHeaders } from './securityHeaders';
import { buildResponseHelpers } from '../../helpers/buildResponseHelpers';
import { resolveCompression } from '../../helpers/compress';
import { clientIp, parseRequest } from '../requestParser';

import type { BaseContext, Stage } from './types';
import type { RawResponse } from '../../helpers/buildResponseHelpers';
import type { ResolvedCompression } from '../../helpers/compress';
import type { Handler } from '../transports';
import type { SSRRequest, SSRResponseHelpers, SSRServerConfig } from '@plitzi/sdk-shared';
import type { IncomingMessage } from 'node:http';

// Builds the per-request context for a given server. Each server supplies its own — an SSR server folds in the
// render deps, an MCP server just the essentials — so the dispatcher stays agnostic of what a server carries.
export type BuildContext<C extends BaseContext> = (
  raw: IncomingMessage,
  rawRes: RawResponse,
  req: SSRRequest,
  res: SSRResponseHelpers
  // `signal` is the dispatcher's to supply: it owns the socket and therefore the only thing that knows when the
  // request died. A builder that had to produce one would be inventing a lifecycle it cannot observe.
) => Omit<C, 'signal'>;

// Query-string VALUES are the part of a URL that routinely carries personal data (emails, tokens, search terms),
// and the access log has no use for them: the KEYS already say which shape of request came in.
const safePath = (url: string): string => {
  const [path = '/', query] = url.split('?');
  if (!query) {
    return path;
  }

  const keys = [...new Set(new URLSearchParams(query).keys())];

  return keys.length > 0 ? `${path}?${keys.join('&')}` : path;
};

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

// Until something is written, `rawRes.statusCode` is still the 200 default while the helpers hold the status a
// stage set; afterwards the wire is the truth (stages like MCP write straight to the raw response).
const statusOf = (rawRes: RawResponse, res: SSRResponseHelpers): number =>
  rawRes.headersSent ? rawRes.statusCode : res.status;

const runPipeline = async <C extends BaseContext>(
  raw: IncomingMessage,
  rawRes: RawResponse,
  buildContext: BuildContext<C>,
  stages: Stage<C>[],
  server: string,
  compression: ResolvedCompression
): Promise<void> => {
  const startedAt = Date.now();
  const req = parseRequest(raw);
  const res = buildResponseHelpers(rawRes, req.headers['accept-encoding'], compression);
  // One controller per request, aborted when the peer hangs up. `once` so a request that ends normally does not
  // leave a listener on a socket the runtime may keep alive for the next one.
  const controller = new AbortController();
  raw.once('close', () => controller.abort());
  // The cast is the price of assembling a generic context from its parts: TypeScript cannot see that adding the
  // one omitted key back reconstructs `C`.
  const ctx = { ...buildContext(raw, rawRes, req, res), signal: controller.signal } as C;
  const logger = ctx.config.logger;
  // Read while the socket is still attached: a request logged from the catch block can outlive its connection.
  const ip = logger ? clientIp(raw, req) : '';

  // Every exit below funnels through this, so a request shows up whether it was served, rejected or threw.
  const logRequest = (error?: unknown): void => {
    if (!logger) {
      return;
    }

    const status = statusOf(rawRes, res);
    logger({
      kind: 'request',
      server,
      // From the parsed request, not the raw one: over HTTP/2 the method and URL live in pseudo-headers.
      method: req.method,
      path: safePath(req.url),
      ...(ip ? { clientIp: ip } : {}),
      ...(ctx.operation === undefined ? {} : { operation: ctx.operation }),
      status,
      durationMs: Date.now() - startedAt,
      // A 4xx is an ANSWER, not a fault: "no such page", "renew your session", "not yours". Flagging those as
      // errors buried the ones that mean something under Chrome probing /.well-known on every devtools open and
      // under every signed-out visitor. The status is on the line either way — this only decides what reads as
      // the server having gone wrong, which is 5xx and a thrown exception.
      ok: !error && status < 500,
      ...(error ? { error: errorText(error) } : {}),
      timestamp: new Date().toISOString()
    });
  };

  try {
    // Reject null bytes immediately — they are never valid in a URL path.
    if (req.path === '\0') {
      res.setStatus(400);
      res.end();
      logRequest();

      return;
    }

    applySecurityHeaders(res, ctx.config, ctx.port);

    for (const stage of stages) {
      if (await stage(ctx)) {
        logRequest();

        return;
      }
    }

    logRequest();
  } catch (error) {
    logRequest(error);

    throw error;
  }
};

// Turns a server's context builder + pipeline into an HTTP handler. Errors that escape a stage produce a bare
// 500 so the socket is never left hanging. `label` names the server in logs (e.g. SSR, MCP).
export const makeHandler = <C extends BaseContext>(
  label: string,
  buildContext: BuildContext<C>,
  stages: Stage<C>[],
  compressionConfig?: SSRServerConfig['compression']
): Handler => {
  // Resolved once per server rather than per request: the policy cannot change between requests, and the
  // defaults would otherwise be re-merged on every one of them.
  const compression = resolveCompression(compressionConfig);

  return (raw, rawRes) => {
    runPipeline(raw, rawRes, buildContext, stages, label, compression).catch((err: unknown) => {
      console.error(`[${label}] Unhandled error:`, err);
      try {
        if (!rawRes.headersSent) {
          rawRes.writeHead(500, { 'Content-Type': 'text/plain' });
        }

        rawRes.end('Internal Server Error');
      } catch {
        // stream already closed
      }
    });
  };
};
