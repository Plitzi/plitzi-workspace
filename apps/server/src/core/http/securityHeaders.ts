import type { SSRResponseHelpers, SSRServerConfig } from '@plitzi/sdk-shared';

// Cross-cutting headers set on every response before any stage runs. Not a stage: it never answers the
// request, it only decorates the response.
export const applySecurityHeaders = (res: SSRResponseHelpers, config: SSRServerConfig, port: number): void => {
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
};
