import { describe, expect, it } from 'vitest';

import { buildRscCacheKey } from './keys';

const req = (path: string, search = '', hostname = 'site.example.com') => ({ hostname, path, search });

describe('buildRscCacheKey', () => {
  it('separates two routes of the same space, environment and revision', () => {
    const a = buildRscCacheKey(1, 'production', 3, undefined, undefined, req('/blog/a'));
    const b = buildRscCacheKey(1, 'production', 3, undefined, undefined, req('/blog/b'));

    expect(a).not.toBe(b);
  });

  it('separates two query strings of the same path', () => {
    const a = buildRscCacheKey(1, 'production', 3, undefined, undefined, req('/search', '?q=shoes'));
    const b = buildRscCacheKey(1, 'production', 3, undefined, undefined, req('/search', '?q=hats'));

    expect(a).not.toBe(b);
  });

  it('separates the same path served on two domains', () => {
    const a = buildRscCacheKey(1, 'production', 3, undefined, undefined, req('/', '', 'one.example.com'));
    const b = buildRscCacheKey(1, 'production', 3, undefined, undefined, req('/', '', 'two.example.com'));

    expect(a).not.toBe(b);
  });

  it('separates an authenticated slice from an anonymous one', () => {
    const anon = buildRscCacheKey(1, 'production', 3, undefined, undefined, req('/account'));
    const user = buildRscCacheKey(1, 'production', 3, 42, undefined, req('/account'));

    expect(anon).not.toBe(user);
  });

  it('separates a partial refresh from a full one', () => {
    const full = buildRscCacheKey(1, 'production', 3, undefined, undefined, req('/'));
    const partial = buildRscCacheKey(1, 'production', 3, undefined, 'el1,el2', req('/'));

    expect(full).not.toBe(partial);
  });

  it('is stable for the same request', () => {
    const a = buildRscCacheKey(1, 'production', 3, 42, 'el1', req('/blog/a', '?page=2'));
    const b = buildRscCacheKey(1, 'production', 3, 42, 'el1', req('/blog/a', '?page=2'));

    expect(a).toBe(b);
  });

  it('does not let a field boundary be forged from adjacent values', () => {
    const a = buildRscCacheKey(1, 'production', 3, undefined, undefined, req('/a', '', 'x'));
    const b = buildRscCacheKey(1, 'production', 3, undefined, undefined, req('/a', '', 'x'));
    const shifted = buildRscCacheKey(1, 'production', 3, undefined, 'x', req('/a', '', ''));

    expect(a).toBe(b);
    expect(a).not.toBe(shifted);
  });
});
