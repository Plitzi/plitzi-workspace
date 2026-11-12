import { describe, expect, it } from 'vitest';

import { apiContainer, authorSpace, blockHtml, component, container, heading } from '../../index';

import type { PageSpec, SpaceSpec } from '../../index';

/** The pages a space is told draw no `main`. */
const offered = (spec: SpaceSpec): string[] =>
  authorSpace(spec)
    .suggestions.filter(suggestion => suggestion.code === 'page-without-main')
    .map(suggestion => suggestion.elementIds[0]);

const page = (id: string, body: PageSpec['body'], more: Partial<PageSpec> = {}): PageSpec => ({
  id,
  name: id,
  slug: id === 'home' ? '' : id,
  body,
  ...more
});

describe('page-without-main, a suggestion', () => {
  it('offers a page that draws no main, and none for one that does', () => {
    expect(
      offered({
        name: 'Plans',
        permanentUrl: 'plans',
        pages: [
          page('home', [heading('Plans', { id: 'title' })]),
          page('faq', [container({ id: 'faq-main', subType: 'main', children: [heading('FAQ', { id: 'faq-title' })] })])
        ]
      })
    ).toEqual(['home']);
  });

  it('reads a provider drawn as main', () => {
    expect(
      offered({
        name: 'Shop',
        permanentUrl: 'shop',
        pages: [page('home', [apiContainer({ id: 'catalog', subType: 'main', query: '/data/products.json' })])]
      })
    ).toEqual([]);
  });

  // The layout's slot is where a shell's pages draw their content: a `main` there is every page's.
  it('reads a page inside its layout', () => {
    expect(
      offered({
        name: 'Shell',
        permanentUrl: 'shell',
        layouts: [
          { id: 'app', body: [heading('App', { id: 'app-title' }), container({ id: 'app-main', subType: 'main' })] }
        ],
        pages: [
          page('home', [heading('Visits', { id: 'visits', subType: 'h2' })], {
            layout: { id: 'app', slot: 'app-main' }
          })
        ]
      })
    ).toEqual([]);
  });

  it('reads the main a component draws', () => {
    expect(
      offered({
        name: 'Parts',
        permanentUrl: 'parts',
        components: [
          {
            id: 'frame',
            root: container({ id: 'frame-root', subType: 'main', children: [heading('In', { id: 'in' })] })
          }
        ],
        pages: [page('home', [component('frame', { id: 'frame-here' })])]
      })
    ).toEqual([]);
  });

  // Markup the linter cannot read may hold one: nothing is said rather than something wrong.
  it('says nothing of a page drawing markup it cannot read', () => {
    expect(
      offered({
        name: 'Raw',
        permanentUrl: 'raw',
        pages: [page('home', [blockHtml({ id: 'raw', content: '<main><h1>Hi</h1></main>' })])]
      })
    ).toEqual([]);
  });

  it('is quieted on the page that says why', () => {
    expect(
      offered({
        name: 'Embed',
        permanentUrl: 'embed',
        pages: [page('home', [heading('Widget', { id: 'w' })], { quiet: ['page-without-main'] })]
      })
    ).toEqual([]);
  });
});
