import { describe, expect, it } from 'vitest';

import { applySecurityHeaders } from './securityHeaders';

import type { SSRRequest, SSRResponseHelpers } from '../types';
import type { ServerBaseConfig } from '../types';

/** The headers a response was given, by name. */
const headersFor = (
  req: Pick<SSRRequest, 'protocol' | 'hostname'>,
  config: Pick<ServerBaseConfig, 'hsts' | 'crossOriginOpenerPolicy'> = {}
) => {
  const headers: Record<string, string> = {};
  // Only `setHeader` is ever called on a response here: the rest of the helpers are no part of what is checked.
  const res = { setHeader: (name: string, value: string) => (headers[name] = value) } as unknown as SSRResponseHelpers;
  applySecurityHeaders(req, res, config, 443);

  return headers;
};

const site = { protocol: 'https', hostname: 'acme.plitzi.app' } as const;

describe('the security headers', () => {
  // Lighthouse's "Use a strong HSTS policy": a year, every sub-domain — and preload only when the deployment says so.
  it('tells a browser over https to never ask the site over http, for a year and every sub-domain', () => {
    expect(headersFor(site)['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
    expect(headersFor(site, { hsts: { preload: true } })['Strict-Transport-Security']).toBe(
      'max-age=31536000; includeSubDomains; preload'
    );
    expect(headersFor(site, { hsts: false })['Strict-Transport-Security']).toBeUndefined();
  });

  // A browser told so refuses a development certificate with no way past it.
  it('says nothing of it over http, on this machine, or on a domain no public authority certifies', () => {
    for (const req of [
      { protocol: 'http', hostname: 'acme.plitzi.app' },
      { protocol: 'https', hostname: 'localhost' },
      { protocol: 'https', hostname: '192.168.1.5' },
      { protocol: 'https', hostname: 'ssr.plitzi.local' },
      { protocol: 'https', hostname: 'shop.test' }
    ] as const) {
      expect(headersFor(req)['Strict-Transport-Security'], req.hostname).toBeUndefined();
    }
  });

  // Lighthouse's "Ensure proper origin isolation with COOP": what a page opens can still answer it, by default.
  it('isolates the page from another site’s windows, keeping what it opens', () => {
    expect(headersFor(site)['Cross-Origin-Opener-Policy']).toBe('same-origin-allow-popups');
    expect(headersFor(site, { crossOriginOpenerPolicy: 'same-origin' })['Cross-Origin-Opener-Policy']).toBe(
      'same-origin'
    );
    expect(headersFor(site, { crossOriginOpenerPolicy: false })['Cross-Origin-Opener-Policy']).toBeUndefined();
  });
});
