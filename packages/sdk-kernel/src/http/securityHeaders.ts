import { isLocalHost, isPrivateNetworkHost } from '../identity/session';

import type { SSRRequest, SSRResponseHelpers } from '../types';
import type { ServerBaseConfig } from '../types';
import type { SSRSpaceDeployment } from '../types';

/** What of the server's configuration these headers read. */
type HeadersConfig = Pick<ServerBaseConfig, 'frameOptions' | 'hsts' | 'crossOriginOpenerPolicy' | 'httpVersion'>;

/** A year: what the browsers' preload list asks of a site, and what Lighthouse takes as a strong policy. */
const HSTS_MAX_AGE = 31_536_000;

/** Domains no public certificate authority signs for: a development certificate is all they ever have. */
const UNCERTIFIED = /\.(local|test|localhost|internal)$/;

/**
 * The `Strict-Transport-Security` a response over https carries, or none — see `ServerBaseConfig.hsts` — and on a host
 * whose deployment says (`SSRDeploymentSecurity.hsts`): `'host'` keeps to that host alone, `'subdomains'` reaches every
 * sub-domain of it, `'off'` asks nothing.
 */
export const hstsFor = (
  req: Pick<SSRRequest, 'protocol' | 'hostname'>,
  config: HeadersConfig,
  chosen?: 'off' | 'host' | 'subdomains'
): string | undefined => {
  const { hsts } = config;
  const { hostname } = req;
  if (
    hsts === false ||
    chosen === 'off' ||
    req.protocol !== 'https' ||
    isLocalHost(hostname) ||
    isPrivateNetworkHost(hostname) ||
    UNCERTIFIED.test(hostname)
  ) {
    return undefined;
  }

  const { maxAge = HSTS_MAX_AGE, includeSubDomains = true, preload = false } = hsts ?? {};
  const subDomains = chosen === undefined ? includeSubDomains : chosen === 'subdomains';

  return [
    `max-age=${String(maxAge)}`,
    ...(subDomains ? ['includeSubDomains'] : []),
    ...(preload && subDomains ? ['preload'] : [])
  ].join('; ');
};

/**
 * Who may put the page in a frame, as CSP `frame-ancestors`: the space's own list when its deployment names one — only
 * it knows the sites its owner allowed — and the sites its domain adds (`security.frameAncestors`), else the server's
 * `frameOptions`. One place, because the page's script policy is sent in the same header (`pagePolicies`) and a second
 * header would replace this one.
 */
export const frameAncestorsOf = (
  config: Pick<ServerBaseConfig, 'frameOptions'>,
  deployment?: Pick<SSRSpaceDeployment, 'frameAncestors' | 'security'>
): string | undefined => {
  const ofSpace = deployment?.frameAncestors ?? [];
  const ofDomain = deployment?.security?.frameAncestors ?? [];
  if (ofSpace.length > 0 || ofDomain.length > 0) {
    // A domain's sites are added to the space's. Where the space names none, its own host still frames its pages.
    const sources = [...(ofSpace.length > 0 ? ofSpace : ["'self'"]), ...ofDomain];

    return `frame-ancestors ${[...new Set(sources)].join(' ')}`;
  }

  const frameOptions = config.frameOptions === undefined ? 'DENY' : config.frameOptions;
  if (!frameOptions) {
    return undefined;
  }

  return Array.isArray(frameOptions)
    ? `frame-ancestors ${frameOptions.join(' ')}`
    : `frame-ancestors '${frameOptions === 'DENY' ? 'none' : 'self'}'`;
};

export const applySecurityHeaders = (
  req: Pick<SSRRequest, 'protocol' | 'hostname'>,
  res: SSRResponseHelpers,
  config: HeadersConfig,
  port: number
): void => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  const frameAncestors = frameAncestorsOf(config);
  if (frameAncestors) {
    res.setHeader('Content-Security-Policy', frameAncestors);
  }

  // DENY / SAMEORIGIN said the old way too, for a browser that reads no CSP; a list has no such form.
  const frameOptions = config.frameOptions === undefined ? 'DENY' : config.frameOptions;
  if (typeof frameOptions === 'string') {
    res.setHeader('X-Frame-Options', frameOptions);
  }

  const hsts = hstsFor(req, config);
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
