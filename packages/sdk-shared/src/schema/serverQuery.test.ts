import { describe, expect, it } from 'vitest';

import { serverQueryOf } from './serverQuery';

import type { Element } from '../types';

const provider = (
  attributes: Record<string, unknown>,
  bound: string[] = []
): Pick<Element, 'attributes' | 'definition'> => ({
  attributes,
  definition: {
    type: 'apiContainer',
    bindings: { attributes: bound.map((to, index) => ({ id: `b${String(index)}`, to, source: 'state.token' })) }
    // A provider's definition holds more than a fixture needs; what this reads is its bindings.
  } as Element['definition']
});

describe("a server provider's query, as the page server reads it", () => {
  it('reads a path of the space as a file, and another site’s address as a GET with the headers it declares', () => {
    expect(serverQueryOf(provider({ query: '/data/menu.json' }))).toEqual({ kind: 'path', path: '/data/menu.json' });

    const asked = serverQueryOf(
      provider({
        query: 'https://api.example.com/items?page=2',
        headers: { Accept: 'application/json' },
        accessToken: 'pk'
      })
    );
    expect(asked?.kind).toBe('url');
    expect(asked?.kind === 'url' && asked.url.href).toBe('https://api.example.com/items?page=2');
    expect(asked?.kind === 'url' && asked.headers).toEqual({ Accept: 'application/json', Authorization: 'Bearer pk' });
    expect(serverQueryOf(provider({ query: 'https://api.example.com/', method: 'get' }))?.kind).toBe('url');
  });

  it('says why when the browser alone can ask it: bound, templated, another method, no protocol, not an address', () => {
    const why = (attributes: Record<string, unknown>, bound: string[] = []) => {
      const read = serverQueryOf(provider(attributes, bound));

      return read?.kind === 'unresolved' ? read.why : read?.kind;
    };

    expect(why({ query: 'https://api.example.com/' }, ['accessToken'])).toContain('accessToken is bound');
    expect(why({ query: 'https://api.example.com/{{ navigation.routeParams.id }}' })).toContain('template');
    expect(why({ query: 'https://api.example.com/', accessToken: '{{ auth.token }}' })).toContain('template');
    expect(why({ query: 'https://api.example.com/', method: 'post' })).toContain('POST');
    expect(why({ query: 'https://api.example.com/me', credentials: 'include' })).toContain("visitor's cookies");
    expect(why({ query: '//api.example.com/' })).toContain('names no protocol');
    expect(why({ query: 'items.json' })).toContain('neither an address');
    expect(why({ query: 'ftp://example.com/x' })).toContain('ftp:');
  });

  it('is nothing for a provider with no query', () => {
    expect(serverQueryOf(provider({ action: 'list-posts' }))).toBeUndefined();
    expect(serverQueryOf(provider({ query: '' }))).toBeUndefined();
  });
});
