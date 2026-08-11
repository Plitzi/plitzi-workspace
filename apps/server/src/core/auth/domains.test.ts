import { describe, expect, it } from 'vitest';

import { ANY_DOMAIN, domainAllowed, hostnameOf } from './domains';

// The plitzi deployment feeds hostnameOf the union of its allowed origins, its renderer domains and its MCP
// self-url — full origins, some carrying a port, one that is not a URL at all. Every one must reduce to the bare
// host a request reports, or the "is this one of ours?" checks (identity platformHosts, the builder-preview gate
// in ssrAdapters) never match in dev.
describe('hostnameOf', () => {
  it.each([
    ['plitzi-desktop', 'plitzi-desktop'],
    ['https://plitzi.local', 'plitzi.local'],
    ['https://app.plitzi.local', 'app.plitzi.local'],
    ['https://plitzi.com', 'plitzi.com'],
    ['https://stg.plitzi.com', 'stg.plitzi.com'],
    ['https://dev.plitzi.com', 'dev.plitzi.com'],
    ['http://localhost:6006', 'localhost'],
    ['https://website.plitzi.app', 'website.plitzi.app'],
    ['https://app.plitzi.local:3000', 'app.plitzi.local'],
    ['https://app.plitzi.local:3001', 'app.plitzi.local'],
    ['https://ssr.plitzi.local', 'ssr.plitzi.local'],
    ['https://server.plitzi.local', 'server.plitzi.local'],
    ['https://mcp.plitzi.local', 'mcp.plitzi.local'],
    ['chrome-extension://flnheeellpciglgpaodhkhmapeljopja', 'flnheeellpciglgpaodhkhmapeljopja']
  ])('reduces %s to %s', (declared, host) => {
    expect(hostnameOf(declared)).toBe(host);
  });

  it('reduces a bare host — what a request reports — to itself', () => {
    expect(hostnameOf('app.plitzi.local')).toBe('app.plitzi.local');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(hostnameOf('  HTTPS://App.Plitzi.Local/x  ')).toBe('app.plitzi.local');
  });

  it('yields empty for values with no host at all', () => {
    expect(hostnameOf('')).toBe('');
    expect(hostnameOf('::::')).toBe('');
  });
});

describe('domainAllowed', () => {
  // The builder-preview gate in plitzi's ssrAdapters: is this request host one of the deployment's own, once the
  // port the dev origins are declared with stops being part of the comparison? This is the regression that kept
  // fromPlitzi false for a request to app.plitzi.local in dev.
  it('matches a request host to a platform origin declared with a port', () => {
    expect(domainAllowed('app.plitzi.local', [], ['https://app.plitzi.local:3000', 'https://ssr.plitzi.local'])).toBe(
      true
    );
  });

  it('never matches a host that no declaration names', () => {
    expect(domainAllowed('attacker.example', [], ['https://app.plitzi.local:3000'])).toBe(false);
  });

  it('treats * as every host', () => {
    expect(domainAllowed('anything.example', [ANY_DOMAIN], [])).toBe(true);
  });
});
