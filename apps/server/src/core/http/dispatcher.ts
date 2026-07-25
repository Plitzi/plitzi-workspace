import { applySecurityHeaders } from './securityHeaders';
import { buildResponseHelpers } from '../../helpers/buildResponseHelpers';
import { parseRequest } from '../requestParser';

import type { BaseContext, Stage } from './types';
import type { RawResponse } from '../../helpers/buildResponseHelpers';
import type { Handler } from '../transports';
import type { SSRRequest, SSRResponseHelpers } from '@plitzi/sdk-shared';
import type { IncomingMessage } from 'node:http';

// Builds the per-request context for a given server. Each server supplies its own — an SSR server folds in the
// render deps, an MCP server just the essentials — so the dispatcher stays agnostic of what a server carries.
export type BuildContext<C extends BaseContext> = (
  raw: IncomingMessage,
  rawRes: RawResponse,
  req: SSRRequest,
  res: SSRResponseHelpers
) => C;

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
  server: string
): Promise<void> => {
  const startedAt = Date.now();
  const req = parseRequest(raw);
  const res = buildResponseHelpers(rawRes, req.headers['accept-encoding']);
  const ctx = buildContext(raw, rawRes, req, res);
  const logger = ctx.config.logger;

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
      ...(ctx.operation === undefined ? {} : { operation: ctx.operation }),
      status,
      durationMs: Date.now() - startedAt,
      ok: !error && status < 400,
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
  stages: Stage<C>[]
): Handler => {
  return (raw, rawRes) => {
    runPipeline(raw, rawRes, buildContext, stages, label).catch((err: unknown) => {
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
