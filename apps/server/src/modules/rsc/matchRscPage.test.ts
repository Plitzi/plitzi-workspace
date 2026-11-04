import { describe, expect, it } from 'vitest';

import { matchRscPage } from './matchRscPage';

import type { Schema } from '@plitzi/sdk-shared';

const page = (id: string, slug: string, attributes: Record<string, unknown> = {}) => ({
  id,
  attributes: { slug, ...attributes },
  definition: { rootId: id, label: id, type: 'page', items: [], styleSelectors: { base: '' } }
});

const schema = (): Schema =>
  ({
    pages: ['home', 'post', 'account'],
    pageFolders: [],
    flat: {
      home: page('home', ''),
      post: page('post', 'posts/:slug'),
      account: page('account', 'account', { accessLevel: 'authenticated' })
    }
  }) as unknown as Schema;

describe('matchRscPage', () => {
  it('names the page an address reaches and its params, the same each time it is asked', () => {
    const space = schema();

    expect(matchRscPage(space, '/posts/hello', undefined)).toEqual({ pageId: 'post', routeParams: { slug: 'hello' } });
    expect(matchRscPage(space, '/posts/again', undefined)).toEqual({ pageId: 'post', routeParams: { slug: 'again' } });
    expect(matchRscPage(space, '/', undefined)?.pageId).toBe('home');
  });

  // Kept per schema object and per signed in or out: a schema changed is another object, read anew.
  it('reads a changed space as it now is', () => {
    const space = schema();
    matchRscPage(space, '/', undefined);
    const renamed = { ...space, flat: { ...space.flat, post: page('post', 'articles/:slug') } } as unknown as Schema;

    expect(matchRscPage(renamed, '/articles/hello', undefined)).toEqual({
      pageId: 'post',
      routeParams: { slug: 'hello' }
    });
  });
});
