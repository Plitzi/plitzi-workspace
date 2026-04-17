import http from 'node:http';
import http2 from 'node:http2';

import { parseRequest } from './requestParser';
import { serveStatic } from './staticFiles';
import { buildResponseHelpers } from '../helpers/buildResponseHelpers';
import { runMiddlewares } from '../helpers/runMiddlewares';
import { basicAuthMiddleware } from '../middlewares/basicAuth';
import { spaceDeploymentMiddleware } from '../middlewares/spaceDeployment';
import { renderSSR } from '../ssr/render';

import type { Http2ServerRequest, Http2ServerResponse } from 'node:http2';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { SSRServerConfig, SSRRequest, SSRResponseHelpers, SSRContext } from '../types';

type HandleFn = (req: Http2ServerRequest | IncomingMessage, res: Http2ServerResponse | ServerResponse) => void;

const handleRequest = async (
  raw: Http2ServerRequest | IncomingMessage,
  rawRes: Http2ServerResponse | ServerResponse,
  config: SSRServerConfig
): Promise<void> => {
  const req = parseRequest(raw);
  const res = buildResponseHelpers(rawRes);

  // ── Well-known routes ─────────────────────────────────────────────────────
  if (req.path.startsWith('/.well-known/')) {
    res.send('Well-known route');
    return;
  }

  // ── Static file routes ────────────────────────────────────────────────────
  if (config.static) {
    for (const [prefix, rootDir] of Object.entries(config.static)) {
      const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
      if (req.path === prefix || req.path.startsWith(normalizedPrefix)) {
        const strippedReq: SSRRequest = {
          ...req,
          path: req.path.slice(prefix.length) || '/'
        };
        const served = serveStatic(strippedReq, res, rootDir);
        if (served) return;
      }
    }
  }

  // ── Middleware pipeline ───────────────────────────────────────────────────
  const ctx: SSRContext = {};

  const middlewares = [spaceDeploymentMiddleware(config.adapters), basicAuthMiddleware()];

  let stopped = false;
  await runMiddlewares(middlewares, req, res, ctx, () => {
    stopped = true;
  });

  if (stopped || res.status !== 200) return;

  // ── SSR render ────────────────────────────────────────────────────────────
  await renderSSR(req, res, ctx, config);
};

const makeHandler = (config: SSRServerConfig): HandleFn => {
  return (raw, rawRes) => {
    handleRequest(raw as Http2ServerRequest | IncomingMessage, rawRes as Http2ServerResponse | ServerResponse, config).catch(
      (err: unknown) => {
        console.error('[SSR] Unhandled error:', err);
        try {
          if (!rawRes.headersSent) {
            rawRes.writeHead(500, { 'Content-Type': 'text/plain' });
          }
          rawRes.end('Internal Server Error');
        } catch {
          // Stream may already be closed
        }
      }
    );
  };
};

export type SSRServer = {
  listen: (port: number, host?: string) => void;
  close: () => Promise<void>;
};

/**
 * Create an HTTP/2 (or HTTP/1 fallback) server that handles SSR requests.
 *
 * - When `config.tls` is provided: creates a TLS-secured HTTP/2 server.
 * - Otherwise: creates a plain-text server with `allowHTTP1: true` for
 *   backwards-compatible HTTP/1.1 clients.
 */
export const createSSRServer = (config: SSRServerConfig): SSRServer => {
  const handler = makeHandler(config);

  const server = config.tls
    ? http2.createSecureServer({ key: config.tls.key, cert: config.tls.cert, allowHTTP1: true }, handler)
    : http.createServer(handler);

  return {
    listen(port: number, host = '0.0.0.0') {
      server.listen(port, host, () => {
        console.log(`[SSR] Server listening on ${host}:${port}${config.tls ? ' (TLS)' : ''}`);
      });
    },
    close() {
      return new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  };
};
