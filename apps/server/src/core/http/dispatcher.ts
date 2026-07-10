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

const runPipeline = async <C extends BaseContext>(
  raw: IncomingMessage,
  rawRes: RawResponse,
  buildContext: BuildContext<C>,
  stages: Stage<C>[]
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

  for (const stage of stages) {
    if (await stage(ctx)) {
      return;
    }
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
    runPipeline(raw, rawRes, buildContext, stages).catch((err: unknown) => {
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
