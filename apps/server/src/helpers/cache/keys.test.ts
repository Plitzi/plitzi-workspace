import { describe, expect, it } from 'vitest';

import { buildHtmlCacheKey, buildRscCacheKey } from './keys';

const req = (path: string, search = '', hostname = 'site.example.com', cookie?: string) => ({
  hostname,
  path,
  search,
  headers: { cookie }
});

/**
 * The rendered document wears the visitor's theme — on `<html>` and in the props the SDK hydrates with — so two
 * visitors with different choices must never be handed the same cached copy.
 */
describe('buildHtmlCacheKey', () => {
  const html = (cookie?: string) =>
    buildHtmlCacheKey(undefined, 1, 'production', 3, req('/', '', 'site.example.com', cookie));

  it('separates a visitor who chose dark from one who chose light', () => {
    expect(html('theme=dark')).not.toBe(html('theme=light'));
  });

  it('separates a visitor with a choice from one with none', () => {
    expect(html('theme=dark')).not.toBe(html());
  });

  it('is not split by cookies that do not change the document', () => {
    expect(html('theme=dark; _ga=GA1.2.3; consent=yes')).toBe(html('_ga=other; theme=dark'));
    expect(html('_ga=GA1.2.3')).toBe(html());
  });

  it('ignores a theme cookie holding something that is not a theme', () => {
    expect(html('theme=purple')).toBe(html());
  });
});

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
