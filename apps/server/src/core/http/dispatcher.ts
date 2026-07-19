import { applySecurityHeaders } from './securityHeaders';
import { buildResponseHelpers } from '../../helpers/buildResponseHelpers';
import { parseRequest } from '../requestParser';

import type { BaseContext, PipelineStage } from './types';
import type { RawResponse } from '../../helpers/buildResponseHelpers';
import type { Handler } from '../transports';
import type { ServerLogger, SSRRequest, SSRResponseHelpers } from '@plitzi/sdk-shared';
import type { IncomingMessage } from 'node:http';

// Builds the per-request context for a given server. Each server supplies its own — an SSR server folds in the
// render deps, an MCP server just the essentials — so the dispatcher stays agnostic of what a server carries.
export type BuildContext<C extends BaseContext> = (
  raw: IncomingMessage,
  rawRes: RawResponse,
  req: SSRRequest,
  res: SSRResponseHelpers
) => C;

// Emit one consolidated `request` log event per request, tagged with the service that answered it (or the server's
// own label when nothing matched). This is the single logging point for every service in the pipeline.
const logRequest = (
  logger: ServerLogger,
  service: string,
  req: SSRRequest,
  res: SSRResponseHelpers,
  start: number,
  error: unknown
): void => {
  const status = error && res.status < 500 ? 500 : res.status;
  logger({
    kind: 'request',
    service,
    method: req.method,
    path: req.path,
    status,
    durationMs: performance.now() - start,
    ok: !error && status < 500,
    ...(error ? { error: error instanceof Error ? error.message : String(error) } : {}),
    timestamp: new Date().toISOString()
  });
};

const runPipeline = async <C extends BaseContext>(
  raw: IncomingMessage,
  rawRes: RawResponse,
  buildContext: BuildContext<C>,
  stages: PipelineStage<C>[],
  label: string
): Promise<void> => {
  const req = parseRequest(raw);
  const res = buildResponseHelpers(rawRes, req.headers['accept-encoding']);

  // Reject null bytes immediately — they are never valid in a URL path.
  if (req.path === '\0') {
    res.setStatus(400);
    res.end();

    return;
  }

  const ctx = buildContext(raw, rawRes, req, res);
  applySecurityHeaders(res, ctx.config, ctx.port);

  const logger = ctx.config.logger;
  const start = logger ? performance.now() : 0;
  // Falls back to the server label (lower-cased) when no stage matched — e.g. a request that ran the whole
  // pipeline without a terminal stage answering.
  let service = label.toLowerCase();
  let error: unknown;
  try {
    for (const entry of stages) {
      if (await entry.stage(ctx)) {
        service = entry.service;

        return;
      }
    }
  } catch (err) {
    error = err;
    throw err;
  } finally {
    if (logger) {
      logRequest(logger, service, req, res, start, error);
    }
  }
};

// Turns a server's context builder + pipeline into an HTTP handler. Errors that escape a stage produce a bare
// 500 so the socket is never left hanging. `label` names the server in logs (e.g. SSR, MCP).
export const makeHandler = <C extends BaseContext>(
  label: string,
  buildContext: BuildContext<C>,
  stages: PipelineStage<C>[]
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
