import { isLocalHost, isPrivateNetworkHost } from '../auth/session';

import type { SSRRequest, SSRResponseHelpers, SSRServerConfig } from '@plitzi/sdk-shared';

/** What of the server's configuration these headers read. */
type HeadersConfig = Pick<SSRServerConfig, 'frameOptions' | 'hsts' | 'crossOriginOpenerPolicy' | 'httpVersion'>;

/** A year: what the browsers' preload list asks of a site, and what Lighthouse takes as a strong policy. */
const HSTS_MAX_AGE = 31_536_000;

/** Domains no public certificate authority signs for: a development certificate is all they ever have. */
const UNCERTIFIED = /\.(local|test|localhost|internal)$/;

/** The `Strict-Transport-Security` a response over https carries, or none — see `SSRServerConfig.hsts`. */
const hstsOf = (req: Pick<SSRRequest, 'protocol' | 'hostname'>, config: HeadersConfig): string | undefined => {
  const { hsts } = config;
  const { hostname } = req;
  if (
    hsts === false ||
    req.protocol !== 'https' ||
    isLocalHost(hostname) ||
    isPrivateNetworkHost(hostname) ||
    UNCERTIFIED.test(hostname)
  ) {
    return undefined;
  }

  const { maxAge = HSTS_MAX_AGE, includeSubDomains = true, preload = false } = hsts ?? {};

  return [
    `max-age=${String(maxAge)}`,
    ...(includeSubDomains ? ['includeSubDomains'] : []),
    ...(preload ? ['preload'] : [])
  ].join('; ');
};

// Cross-cutting headers set on every response before any stage runs. Not a stage: it never answers the
// request, it only decorates the response.
export const applySecurityHeaders = (
  req: Pick<SSRRequest, 'protocol' | 'hostname'>,
  res: SSRResponseHelpers,
  config: HeadersConfig,
  port: number
): void => {
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

  const hsts = hstsOf(req, config);
  if (hsts) {
    res.setHeader('Strict-Transport-Security', hsts);
  }

  const opener = config.crossOriginOpenerPolicy ?? 'same-origin-allow-popups';
  if (opener) {
    res.setHeader('Cross-Origin-Opener-Policy', opener);
  }

  if ((config.httpVersion ?? 2) >= 3) {
    res.setHeader('Alt-Svc', `h3=":${port}"; ma=86400`);
  }
};
