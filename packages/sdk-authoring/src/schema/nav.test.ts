import { describe, expect, it } from 'vitest';

import { authorSpace, navOf } from '../index';

import type { PageSpec } from '../index';

const page = (slug: string, extra: Partial<PageSpec> = {}): PageSpec => ({
  name: slug === '' ? 'Home' : slug,
  slug,
  body: [],
  ...extra
});

describe('a space’s navigation, read off its pages', () => {
  it('lists the pages that say nav, by order then label, a page with others under it a section', () => {
    const pages = [
      page('', { nav: { label: 'Home', order: 0 } }),
      page('vets', { nav: { label: 'Vets' } }),
      page('pets', { nav: { label: 'Pets', order: 2 } }),
      page('pets/:id'),
      page('about', { nav: { label: 'About' } }),
      page('hidden')
    ];

    expect(navOf(pages).map(({ label, href, current }) => [label, href, current])).toEqual([
      ['Home', '/', 'page'],
      ['Pets', '/pets', 'section'],
      ['About', '/about', 'page'],
      ['Vets', '/vets', 'page']
    ]);
  });

  it('puts a page’s folders before its slug, and refuses a folder it was not given', () => {
    const pageFolders = [
      { id: 'company', slug: 'company' },
      { id: 'team', slug: 'team', parent: 'company' }
    ];
    const pages = [page('people', { folder: 'team', nav: { label: 'People' } })];

    expect(navOf(pages, { pageFolders }).map(entry => entry.href)).toEqual(['/company/team/people']);
    expect(() => navOf(pages)).toThrow(/folder "team", which navOf was not given/);
  });

  it('refuses a nav it cannot list — as the space refuses it — and writes none into the document', () => {
    expect(() => navOf([page('pets/:id', { nav: { label: 'A pet' } })])).toThrow(/takes :id/);
    expect(() => authorSpace({ name: 'N', permanentUrl: 'n', pages: [page('', { nav: { label: ' ' } })] })).toThrow(
      /page-nav-invalid/
    );

    const { schema } = authorSpace({
      name: 'N',
      permanentUrl: 'n',
      pages: [page('', { id: 'home', nav: { label: 'Home', order: 1 } })]
    });
    expect(Object.keys(schema.flat.home.attributes)).not.toContain('nav');
  });
});
