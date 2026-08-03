import { describe, expect, it } from 'vitest';

import { matchPath } from './matchPath';

describe('matchPath', () => {
  it('matches a static path exactly', () => {
    expect(matchPath('/about', '/about')?.pathname).toBe('/about');
    expect(matchPath('/about', '/about/team')).toBeNull();
  });

  it('tolerates a trailing slash when end is true', () => {
    expect(matchPath('/about', '/about/')).not.toBeNull();
  });

  it('captures a named param', () => {
    const match = matchPath('/blog/:slug', '/blog/hello-world');

    expect(match?.params).toEqual({ slug: 'hello-world' });
  });

  it('captures several named params', () => {
    const match = matchPath('/:lang/blog/:slug', '/es/blog/hola');

    expect(match?.params).toEqual({ lang: 'es', slug: 'hola' });
  });

  it('does not let a param span a segment boundary', () => {
    expect(matchPath('/blog/:slug', '/blog/a/b')).toBeNull();
  });

  it('requires a non-empty value for a required param', () => {
    expect(matchPath('/blog/:slug', '/blog/')).toBeNull();
  });

  it('treats a trailing ? param as optional', () => {
    expect(matchPath('/blog/:slug?', '/blog')?.params).toEqual({ slug: undefined });
    expect(matchPath('/blog/:slug?', '/blog/x')?.params).toEqual({ slug: 'x' });
  });

  it('keeps an optional param from swallowing the rest of its own segment', () => {
    expect(matchPath('/blog/:slug?', '/blogging')).toBeNull();
  });

  it('leaves param values percent-encoded', () => {
    expect(matchPath('/blog/:slug', '/blog/hello%20world')?.params.slug).toBe('hello%20world');
  });

  it('normalises an encoded separator so a param cannot become two segments', () => {
    expect(matchPath('/blog/:slug', '/blog/a%2Fb')?.params.slug).toBe('a/b');
  });

  it('matches case-insensitively by default and respects caseSensitive', () => {
    expect(matchPath('/About', '/about')).not.toBeNull();
    expect(matchPath({ path: '/About', caseSensitive: true }, '/about')).toBeNull();
  });

  it('captures a splat under the * param', () => {
    const match = matchPath('/files/*', '/files/a/b/c');

    expect(match?.params['*']).toBe('a/b/c');
    expect(match?.pathnameBase).toBe('/files');
  });

  it('matches everything with a bare *', () => {
    const match = matchPath('*', '/anything/at/all');

    expect(match).not.toBeNull();
    expect(match?.params['*']).toBe('anything/at/all');
  });

  it('matches a prefix when end is false', () => {
    expect(matchPath({ path: '/blog', end: false }, '/blog/post/1')).not.toBeNull();
    expect(matchPath({ path: '/blog', end: false }, '/blogging')).toBeNull();
  });

  it('escapes regex metacharacters in the pattern', () => {
    expect(matchPath('/a.b', '/axb')).toBeNull();
    expect(matchPath('/a.b', '/a.b')).not.toBeNull();
  });

  it('reports the resolved pattern', () => {
    expect(matchPath('/about', '/about')?.pattern).toEqual({ path: '/about', caseSensitive: false, end: true });
  });
});
