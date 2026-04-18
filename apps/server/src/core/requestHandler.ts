import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseRequest } from './requestParser';
import { serveStatic } from './staticFiles';
import { buildResponseHelpers } from '../helpers/buildResponseHelpers';
import { runMiddlewares } from '../helpers/runMiddlewares';
import { basicAuthMiddleware } from '../middlewares/basicAuth';
import { spaceDeploymentMiddleware } from '../middlewares/spaceDeployment';
import { renderSSR } from '../ssr/render';

import type { Handler } from './transports';
import type { RawResponse } from '../helpers/buildResponseHelpers';
import type { TtlCache } from '../helpers/ttlCache';
import type { SSRServerConfig, SSRRequest, SSRContext } from '../types';
import type { IncomingMessage } from 'node:http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUILTIN_PUBLIC_DIR = path.resolve(__dirname, '../public');

const handleRequest = async (
  raw: IncomingMessage,
  rawRes: RawResponse,
  config: SSRServerConfig,
  port: number,
  cache: TtlCache<string> | undefined
): Promise<void> => {
  const req = parseRequest(raw);
  const res = buildResponseHelpers(rawRes, req.headers['accept-encoding']);

  if ((config.httpVersion ?? 2) >= 3) {
    res.setHeader('Alt-Svc', `h3=":${port}"; ma=86400`);
  }

  if (req.path.startsWith('/.well-known/')) {
    res.send('Well-known route');
    return;
  }

  if (serveStatic(req, res, BUILTIN_PUBLIC_DIR)) {
    return;
  }

  if (config.static) {
    for (const [prefix, rootDir] of Object.entries(config.static)) {
      const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
      if (req.path === prefix || req.path.startsWith(normalizedPrefix)) {
        const strippedReq: SSRRequest = { ...req, path: req.path.slice(prefix.length) || '/' };
        if (serveStatic(strippedReq, res, rootDir)) {
          return;
        }
      }
    }
  }

  const ctx: SSRContext = {};
  const middlewares = [spaceDeploymentMiddleware(config.adapters), basicAuthMiddleware()];

  let stopped: boolean = false;
  await runMiddlewares(middlewares, req, res, ctx, () => {
    stopped = true;
  });
  if (stopped || res.status !== 200) {
    return;
  }

  await renderSSR(req, res, ctx, config, cache);
};

export const makeHandler = (config: SSRServerConfig, port: number, cache: TtlCache<string> | undefined): Handler => {
  return (raw, rawRes) => {
    handleRequest(raw, rawRes, config, port, cache).catch((err: unknown) => {
      console.error('[SSR] Unhandled error:', err);
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
