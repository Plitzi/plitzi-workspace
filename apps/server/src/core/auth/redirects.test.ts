import { describe, expect, it } from 'vitest';

import { createRedirectPolicy } from './redirects';

const vet = createRedirectPolicy({
  defaultRedirect: 'https://auth.example.com/done',
  allowedRedirects: ['https://app.example.com', 'https://mcp.example.com/']
});

describe('createRedirectPolicy', () => {
  it('lets an allowed origin through as it was written, path and query included', () => {
    expect(vet('https://app.example.com/analytics?range=7d')).toBe('https://app.example.com/analytics?range=7d');
    expect(vet('https://mcp.example.com/authorize?client_id=x')).toBe('https://mcp.example.com/authorize?client_id=x');
  });

  it('always allows the origin of the default itself', () => {
    expect(vet('https://auth.example.com/welcome?redirect=x')).toBe('https://auth.example.com/welcome?redirect=x');
  });

  it('sends anything else to the default', () => {
    expect(vet('https://evil.example/copy')).toBe('https://auth.example.com/done');
    // Same host, different scheme or port, is a different origin.
    expect(vet('http://app.example.com/')).toBe('https://auth.example.com/done');
    expect(vet('https://app.example.com:8443/')).toBe('https://auth.example.com/done');
  });

  it('allows a relative path, and not the spellings of one that leave the site', () => {
    expect(vet('/analytics')).toBe('/analytics');
    expect(vet('//evil.example/x')).toBe('https://auth.example.com/done');
    expect(vet('/\\evil.example/x')).toBe('https://auth.example.com/done');
  });

  it('falls back for a destination that is missing or not a string', () => {
    expect(vet('')).toBe('https://auth.example.com/done');
    expect(vet(undefined)).toBe('https://auth.example.com/done');
    expect(vet(42)).toBe('https://auth.example.com/done');
    expect(vet('not a url')).toBe('https://auth.example.com/done');
  });
});
