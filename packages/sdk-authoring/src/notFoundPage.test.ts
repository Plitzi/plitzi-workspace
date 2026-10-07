import { describe, expect, it } from 'vitest';

import { apiContainer, authorSpace, heading } from './index';

import type { PageSpec, SpaceSpec } from './index';

const space = (pages: PageSpec[]): SpaceSpec => ({
  name: 'Not found',
  permanentUrl: 'not-found',
  layouts: [{ id: 'site', body: [heading('Site', { id: 'site-title' }), { type: 'container', id: 'site-main' }] }],
  pages
});

const home: PageSpec = { id: 'home', name: 'Home', slug: '', layout: { id: 'site', slot: 'site-main' }, body: [] };

describe('the page for an address no page answers', () => {
  it('is a plain one in the home page’s layout when the space declares none, and said', () => {
    const { schema, suggestions } = authorSpace(space([home]));

    expect(schema.flat['plitzi-not-found'].attributes).toMatchObject({ slug: '*' });
    expect(schema.flat['plitzi-not-found'].attributes).toMatchObject({ layout: 'site', layoutContainer: 'site-main' });
    expect(suggestions).toMatchObject([{ code: 'not-found-page', elementIds: ['plitzi-not-found'] }]);
    expect(suggestions[0].message).toContain('in the layout "site"');
  });

  it('is the space’s own when it declares one', () => {
    const notFound: PageSpec = { id: 'lost', name: 'Lost', slug: '*', body: [heading('Lost', { id: 'lost-title' })] };
    const { schema, suggestions } = authorSpace(space([home, notFound]));

    expect(schema.flat['plitzi-not-found']).toBeUndefined();
    expect(schema.flat.lost.attributes).toMatchObject({ slug: '*' });
    expect(suggestions).toEqual([]);
  });
});

/** A server provider says when its answer means the address shows nothing: the page goes out with status 404. */
describe('a provider whose answer is "not found"', () => {
  const post = (fields: Record<string, unknown>) =>
    space([
      home,
      { id: 'lost', name: 'Lost', slug: '*', body: [] },
      {
        id: 'post',
        name: 'Post',
        slug: 'p/:slug',
        body: [apiContainer({ id: 'post-data', query: '/data/posts.json', ...fields })]
      }
    ]);

  it('is written on a server provider, as one expression against its answer', () => {
    const { schema, warnings } = authorSpace(post({ runtime: 'server', notFound: '{{ source.found == false }}' }));
    const byAddress = authorSpace(
      post({
        runtime: 'server',
        notFound: '{{ source.data|filter(p => p.slug == navigation.routeParams.slug)|length == 0 }}'
      })
    );

    expect(schema.flat['post-data'].attributes.notFound).toBe('{{ source.found == false }}');
    // Evaluated in full by the server: not held to what a rendered attribute resolves.
    expect([...warnings, ...byAddress.warnings]).toEqual([]);
  });

  it('is refused on a browser provider, whose answer arrives after the status was sent', () => {
    expect(() => authorSpace(post({ notFound: '{{ source.found == false }}' }))).toThrow(/not-found-in-browser/);
  });

  it('is refused when it is not one expression, since it would never be true', () => {
    expect(() => authorSpace(post({ runtime: 'server', notFound: 'true' }))).toThrow(/not-found-not-a-template/);
  });
});
