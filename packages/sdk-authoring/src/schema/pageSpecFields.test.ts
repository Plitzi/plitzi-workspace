import { describe, expect, it } from 'vitest';

import { apiContainer, authorSpace, PAGE_SPEC_FIELDS, specFromSpace } from '../index';

import type { PageSpec } from '../index';

// The table an edit of a page writes by is the one authoring reads by: every field lands on its attribute.
describe('PAGE_SPEC_FIELDS', () => {
  it('names, for each attribute, the field of the page that writes it', () => {
    const page: PageSpec = {
      id: 'about',
      name: 'About',
      slug: 'about',
      isDefault: true,
      folder: 'company',
      accessLevel: 'authenticated',
      seoTitle: 'About — Example',
      seoDescription: 'Who we are.',
      robots: 'noindex, nofollow',
      structuredData: [{ '@context': 'https://schema.org', '@type': 'Organization', name: 'Example' }],
      notFound: '{{ navigation.routeParams.slug == "gone" }}',
      documentScroll: 'locked',
      body: []
    };
    const { schema } = authorSpace({
      name: 'Fields',
      permanentUrl: 'fields',
      pageFolders: [{ id: 'company', name: 'Company', slug: 'company' }],
      pages: [page]
    });
    const attributes = schema.flat.about.attributes;

    for (const [attribute, field] of Object.entries(PAGE_SPEC_FIELDS)) {
      expect([attribute, attributes[attribute]]).toEqual([attribute, page[field]]);
    }
  });
});

describe('a page’s seoTitle and seoDescription', () => {
  const write = (seo: Pick<PageSpec, 'seoTitle' | 'seoDescription'>, runtime: 'server' | 'client') => () =>
    authorSpace({
      name: 'Seo',
      permanentUrl: 'seo',
      pages: [
        {
          id: 'capsule',
          name: 'Capsule',
          slug: 'c/:slug',
          ...seo,
          body: [apiContainer({ id: 'capsule-data', query: '/data/capsules.json', runtime })]
        }
      ]
    });

  it('reads the page’s server providers and the address, which the server has when it writes the head', () => {
    expect(
      write(
        {
          seoTitle: '{{ apiContainer_capsule-data.title }} — Shop',
          seoDescription: 'Capsule {{ navigation.routeParams.slug }}'
        },
        'server'
      )
    ).not.toThrow();
  });

  it('refuses what is not there yet: a browser provider, or a template it cannot read', () => {
    expect(write({ seoTitle: '{{ apiContainer_capsule-data.title }} — Shop' }, 'client')).toThrow(
      /`seoTitle` reads `apiContainer_capsule-data`, which is not there when the server answers/
    );
    expect(write({ seoDescription: '{{ state.title }}' }, 'server')).toThrow(/`seoDescription` reads `state`/);
  });

  it('takes a notFound of the page itself over the same answers, and refuses one that is never true', () => {
    expect(write({ seoTitle: 'Capsule' }, 'server')).not.toThrow();
    const notFound = (template: string) => () =>
      authorSpace({
        name: 'Seo',
        permanentUrl: 'seo',
        pages: [
          {
            id: 'capsule',
            name: 'Capsule',
            slug: 'c/:slug',
            notFound: template,
            body: [apiContainer({ id: 'capsule-data', query: '/data/capsules.json', runtime: 'server' })]
          }
        ]
      });

    expect(
      notFound('{{ not (apiContainer_capsule-data.data|find("slug", navigation.routeParams.slug)) }}')
    ).not.toThrow();
    expect(notFound('true')).toThrow(/which is never `true`/);
    expect(notFound('{{ not state.capsule }}')).toThrow(/`notFound` reads `state`/);
  });
});

describe('a page’s robots and structured data', () => {
  const write = (page: Pick<PageSpec, 'robots' | 'structuredData'>, settings: Record<string, string | boolean> = {}) => () =>
    authorSpace({
      name: 'Seo',
      permanentUrl: 'seo',
      settings,
      pages: [{ id: 'home', name: 'Home', slug: '', ...page, body: [] }]
    });

  it('writes them for the head, the page searched as it says', () => {
    const { schema } = write({
      robots: 'NoIndex,  nofollow',
      structuredData: { '@context': 'https://schema.org', '@type': 'SportsEvent', name: 'La Velada' }
    })();

    expect(schema.flat.home.attributes).toMatchObject({
      seoEnabled: true,
      seoRobots: 'noindex, nofollow',
      seoStructuredData: [{ '@context': 'https://schema.org', '@type': 'SportsEvent', name: 'La Velada' }]
    });
  });

  it('refuses a directive no search engine reads, and JSON-LD with no type or vocabulary', () => {
    expect(write({ robots: 'noindx' })).toThrow(/\[robots-unknown\].*did you mean "noindex"/s);
    expect(write({ structuredData: { name: 'La Velada' } })).toThrow(/\[structured-data-shape\]/);
    expect(write({ structuredData: { '@context': 'https://schema.org', '@type': 'Event', at: new Date() } })).toThrow(
      /what JSON cannot carry/
    );
  });

  it('reads back as it was written, the space’s robots.txt too', () => {
    const { schema, style } = write(
      { robots: 'noindex', structuredData: { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Seo' } },
      { robotsTxt: 'User-agent: *\nAllow: /\n', viewTransitions: true }
    )();
    const { spec } = specFromSpace({ schema, style });

    expect(spec.pages[0]).toMatchObject({
      robots: 'noindex',
      structuredData: { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Seo' }
    });
    expect(spec.settings?.robotsTxt).toBe('User-agent: *\nAllow: /\n');
    expect(spec.settings?.viewTransitions).toBe(true);
  });

  it('holds the space’s robots.txt to the rules crawlers read', () => {
    expect(write({}, { robotsTxt: 'User-agent: *\nDisallow: /overlay\n# kept out' })).not.toThrow();
    expect(write({}, { robotsTxt: 'User-agent: *\nDisalow: /overlay' })).toThrow(/\[robots-txt-line\].*line 2/s);
    expect(write({}, { robotsTxt: 'Disallow: /overlay' })).toThrow(/names no `User-agent:`/);
  });
});
