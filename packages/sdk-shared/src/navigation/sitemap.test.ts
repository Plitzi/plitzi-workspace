import { describe, expect, it } from 'vitest';

import { sitemapExclusion, sitemapPaths } from './sitemap';

import type { Element, ElementFlagGate, PageFolder } from '../types';

const page = (id: string, attributes: Record<string, unknown>, flag?: ElementFlagGate): Element => ({
  id,
  attributes: { default: false, folder: '', ...attributes },
  definition: {
    rootId: id,
    label: 'Page',
    type: 'page',
    items: [],
    styleSelectors: { base: '' },
    ...(flag ? { flag } : {})
  }
});

const PAGES = [
  page('home', { slug: '', default: true, accessLevel: 'public' }),
  page('dashboard', { slug: '', default: true, accessLevel: 'authenticated' }),
  page('pricing', { slug: 'pricing' }),
  page('terms', { slug: 'terms' }),
  page('post', { slug: ':slug', folder: 'blog' }),
  page('blog', { slug: '', folder: 'blog' }),
  page('missing', { slug: '*' }),
  page('test', { slug: 'test', seoEnabled: true, seoRobots: 'noindex, nofollow' }),
  page('admin', { slug: 'admin', access: { permissions: ['adminManage'] } }),
  page('beta', { slug: 'beta' }, { name: 'newPricing', is: true })
];

const FOLDERS: PageFolder[] = [{ id: 'blog', name: 'Blog', slug: 'blog' }];

const schema = {
  pages: PAGES.map(each => each.id),
  flat: Object.fromEntries(PAGES.map(each => [each.id, each])),
  pageFolders: FOLDERS
};

describe('the sitemap of a space', () => {
  it('lists every page a search engine may read, at the address a link to it resolves to, once each', () => {
    expect(sitemapPaths(schema)).toEqual(['/', '/blog', '/pricing', '/terms']);
  });

  it('says why each page it leaves out is left out', () => {
    const why = Object.fromEntries(PAGES.map(each => [each.id, sitemapExclusion(each)]));

    expect(why).toEqual({
      home: undefined,
      dashboard: 'signedIn',
      pricing: undefined,
      terms: undefined,
      post: 'parameters',
      blog: undefined,
      missing: 'notFound',
      test: 'noindex',
      admin: 'restricted',
      beta: 'flagged'
    });
  });

  it('reads a page’s robots only while its SEO is on, as the head does', () => {
    expect(sitemapExclusion(page('quiet', { slug: 'quiet', seoEnabled: false, seoRobots: 'noindex' }))).toBeUndefined();
  });
});
