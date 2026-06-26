import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseRequest, readRawBody } from './requestParser';
import { serveStatic } from './staticFiles';
import { buildResponseHelpers } from '../helpers/buildResponseHelpers';
import { runMiddlewares } from '../helpers/runMiddlewares';
import { authMiddleware } from '../middlewares/auth';
import { basicAuthMiddleware } from '../middlewares/basicAuth';
import { spaceDeploymentMiddleware } from '../middlewares/spaceDeployment';
import { handleMcp } from '../modules/mcp/handler';
import { handleRsc } from '../modules/rsc/handler';
import { renderSSR } from '../modules/ssr/handler';

import type { Handler } from './transports';
import type { RawResponse } from '../helpers/buildResponseHelpers';
import type { ServerCaches } from '../helpers/cache';
import type { PluginManager } from '../plugins/manager';
import type { SSRServerConfig, SSRRequest, SSRTemplateFn } from '@plitzi/sdk-shared';
import type { IncomingMessage, ServerResponse } from 'node:http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUILTIN_PUBLIC_DIR = path.resolve(__dirname, '../public');

// Same-origin only: reject absolute URLs and protocol-relative `//host` to avoid open redirects.
const safeRedirectTarget = (req: SSRRequest): string => {
  const redirectParam = req.query['redirect'];

  return redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//') ? redirectParam : '/';
};

const handleRequest = async (
  raw: IncomingMessage,
  rawRes: RawResponse,
  config: SSRServerConfig,
  port: number,
  renderFn: SSRTemplateFn,
  caches: ServerCaches,
  pluginManager: PluginManager
): Promise<void> => {
  const req = parseRequest(raw);
  const res = buildResponseHelpers(rawRes, req.headers['accept-encoding']);

  // Reject null bytes immediately — they are never valid in a URL path.
  if (req.path === '\0') {
    res.setStatus(400);
    res.end();

    return;
  }

  // Security headers applied to every response.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  const frameOptions = config.frameOptions === undefined ? 'DENY' : config.frameOptions;
  if (frameOptions) {
    if (Array.isArray(frameOptions)) {
      // Multiple allowed origins: CSP supports a list, X-Frame-Options does not
      res.setHeader('Content-Security-Policy', `frame-ancestors ${frameOptions.join(' ')}`);
    } else {
      // DENY / SAMEORIGIN: set both for broad browser compatibility
      res.setHeader('X-Frame-Options', frameOptions);
      res.setHeader('Content-Security-Policy', `frame-ancestors '${frameOptions === 'DENY' ? 'none' : 'self'}'`);
    }
  }

  if ((config.httpVersion ?? 2) >= 3) {
    res.setHeader('Alt-Svc', `h3=":${port}"; ma=86400`);
  }

  if (serveStatic(req, res, BUILTIN_PUBLIC_DIR)) {
    return;
  }

  if (config.publicDir && serveStatic(req, res, config.publicDir)) {
    return;
  }

  if (req.path.startsWith('/.well-known/')) {
    res.setStatus(404);
    res.end();

    return;
  }

  if (req.path.startsWith(pluginManager.urlPrefix + '/')) {
    const relative = req.path.slice(pluginManager.urlPrefix.length);
    const pluginName = relative.split('/')[1];
    if (pluginName && pluginManager.hasPlugin(pluginName)) {
      await pluginManager.prepare(pluginName);
      const strippedReq: SSRRequest = { ...req, path: relative };
      if (serveStatic(strippedReq, res, pluginManager.outputDir)) {
        return;
      }
    }
    res.setStatus(404);
    res.send('Not found');

    return;
  }

  const loginPath = config.loginPath === false ? null : (config.loginPath ?? '/auth/login');
  if (loginPath && req.method === 'POST' && req.path === loginPath) {
    req.body = await readRawBody(raw);
    const isLoggedIn = await config.adapters.onLogin?.(req, res);

    // A full-page form submission (navigation) must not be answered with a bodyless 401/200, or the
    // browser shows its own error page instead of the view. Redirect so the view re-renders via a GET.
    if (req.headers['sec-fetch-mode'] === 'navigate') {
      res.setStatus(303);
      res.setHeader('Location', isLoggedIn ? safeRedirectTarget(req) : loginPath);
      res.end();

      return;
    }

    res.setStatus(isLoggedIn ? 200 : 401);
    res.end();

    return;
  }

  const logoutPath = config.logoutPath === false ? null : (config.logoutPath ?? '/auth/logout');
  if (logoutPath && req.method === 'POST' && req.path === logoutPath) {
    req.body = await readRawBody(raw);
    await config.adapters.onLogout?.(req, res);

    // On a navigation a 204 keeps the browser on the stale (still logged-in) page. Redirect so the
    // view re-renders in its logged-out state; a fetch can keep the lean 204.
    if (req.headers['sec-fetch-mode'] === 'navigate') {
      res.setStatus(303);
      res.setHeader('Location', safeRedirectTarget(req));
      res.end();

      return;
    }

    res.setStatus(204);
    res.end();

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

  const mcpPath = config.mcp?.path ?? '/mcp';
  if (config.mcp && (config.mcp.enabled ?? true) && req.path.startsWith(mcpPath)) {
    await handleMcp(raw, rawRes as unknown as ServerResponse, config.mcp);

    return;
  }

  const middlewares = [
    spaceDeploymentMiddleware(config.adapters),
    basicAuthMiddleware({ cacheTtlMs: config.cacheTtlMs }),
    authMiddleware(config.adapters),
    ...(config.middlewares || [])
  ];

  const stopped = await runMiddlewares(middlewares, req, res);
  if (stopped || res.status !== 200) {
    return;
  }

  const rscPath = config.rsc?.path ?? '/_rsc';
  const rscEnabled = config.rsc?.enabled ?? !!config.adapters.getRscData;
  if (rscEnabled && req.method === 'GET' && req.path === rscPath) {
    await handleRsc(req, res, config, pluginManager, caches.rsc);

    return;
  }

  await renderSSR(req, res, config, renderFn, pluginManager, caches);
};

export const makeHandler = (
  config: SSRServerConfig,
  port: number,
  renderFn: SSRTemplateFn,
  caches: ServerCaches,
  pluginManager: PluginManager
): Handler => {
  return (raw, rawRes) => {
    handleRequest(raw, rawRes, config, port, renderFn, caches, pluginManager).catch((err: unknown) => {
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
