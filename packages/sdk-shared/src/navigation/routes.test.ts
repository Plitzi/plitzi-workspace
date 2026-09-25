import { describe, expect, it } from 'vitest';

import { getPageFullPath, getPaths, getSlugParams, matchRoutePath, navigationTarget } from './routes';

import type { Element, PageFolder } from '../types';

const page = (id: string, attributes: Record<string, unknown>): Element => ({
  id,
  attributes: { default: false, folder: '', ...attributes },
  definition: { rootId: id, label: 'Page', type: 'page', items: [], styleSelectors: { base: '' } }
});

const folders: PageFolder[] = [
  { id: 'analytics', name: 'Analytics', slug: 'analytics', parentId: '' },
  { id: 'reports', name: 'Reports', slug: 'reports', parentId: 'analytics' }
];

const pages: Record<string, Element> = {
  home: page('home', { slug: '', default: true }),
  overview: page('overview', { slug: '', folder: 'analytics' }),
  audience: page('audience', { slug: 'audience', folder: 'analytics' }),
  run: page('run', { slug: ':runId', folder: 'reports' }),
  reportsIndex: page('reportsIndex', { slug: '', folder: 'reports' })
};

describe('routes', () => {
  it('addresses a page with no slug inside a folder at the folder itself', () => {
    expect(getPageFullPath(pages, folders, 'overview', true)).toBe('/analytics');
    expect(getPageFullPath(pages, folders, 'reportsIndex', true)).toBe('/analytics/reports');
    expect(getPageFullPath(pages, folders, 'audience', true)).toBe('/analytics/audience');
  });

  it('routes the folder address to its index page and a deeper one to its own', () => {
    const paths = getPaths(pages, folders);

    expect(matchRoutePath(paths, '/analytics', false).pageId).toBe('overview');
    expect(matchRoutePath(paths, '/analytics/audience', false).pageId).toBe('audience');
    expect(matchRoutePath(paths, '/analytics/reports', false).pageId).toBe('reportsIndex');
    expect(matchRoutePath(paths, '/analytics/reports/42', false).pageId).toBe('run');
  });

  const sloppySlug = page('sloppy', { slug: 'au//dience', folder: 'analytics' });

  it('reads a page id written as a path, never as a protocol-relative URL', () => {
    expect(getPageFullPath(pages, folders, '/audience', true)).toBe('/analytics/audience');
    expect(getPageFullPath(pages, folders, '//audience', true)).toBe('/analytics/audience');
    // Not a page id at all: taken as the path it already is, slashes collapsed.
    expect(getPageFullPath(pages, folders, '/analytics/audience', true)).toBe('/analytics/audience');
    expect(getPageFullPath(pages, folders, '//nowhere', true)).toBe('/nowhere');
    // The memory of the home page is the same: `/` must stay `/`, the router's home, not leave as `//`.
    expect(getPageFullPath(pages, folders, '/', true)).toBe('/');
  });

  it('collapses runaway slashes in the folder branch too', () => {
    expect(getPageFullPath({ ...pages, sloppy: sloppySlug }, folders, 'sloppy', true)).toBe('/analytics/au/dience');
    expect(getPageFullPath(pages, folders, '/run/42', true)).toBe('/run/42');
  });

  // The string form is an address somebody reads — the builder shows it — so a dynamic segment stays as written;
  // `:param` is the router's spelling, and only the route table is for the router.
  it('keeps a dynamic segment as authored in the string form, and as the router reads it in the table', () => {
    const post = page('post', { slug: 'post/{{slug}}' });

    expect(getPageFullPath({ ...pages, post }, folders, 'post', true)).toBe('/post/{{slug}}');
    expect(getPageFullPath({ ...pages, post }, folders, 'post')).toEqual({ '/post/:slug': 'post', '/post': 'post' });
  });

  it('keeps the object form on normalized paths', () => {
    expect(getPageFullPath(pages, folders, 'audience')).toEqual({
      '/analytics/audience': 'audience',
      '/audience': 'audience'
    });
  });

  it('routes a page whose slug declares more than one param', () => {
    const archive = page('archive', { slug: 'blog/{{year}}/{{slug}}' });
    const match = matchRoutePath(getPaths({ ...pages, archive }, folders), '/blog/2026/hello', false);

    expect(match.pageId).toBe('archive');
    expect(match.pathMatch?.params).toEqual({ year: '2026', slug: 'hello' });
  });

  it('reads the params a slug declares, in either spelling', () => {
    expect(getSlugParams('blog/{{year}}/{{slug}}')).toEqual(['year', 'slug']);
    expect(getSlugParams(':spaceId/update/*')).toEqual(['spaceId']);
    expect(getSlugParams('about')).toEqual([]);
  });
});

/**
 * A flow's `navigate` to a page, which has to land where a link to the same page does.
 *
 * It resolved the page's own slug and nothing else, so a page in a folder lost the folder — `/audience` rather than
 * `/analytics/audience` — and a folder's index page, whose slug is empty, went to the home page.
 */
describe('navigationTarget', () => {
  it('goes to a page in a folder at its full path, as a link to it does', () => {
    expect(navigationTarget(pages, folders, 'audience')).toBe('/analytics/audience');
    expect(navigationTarget(pages, folders, 'audience')).toBe(getPageFullPath(pages, folders, 'audience', true));
  });

  it('goes to a folder\u2019s index page at the folder, not at the home page', () => {
    expect(navigationTarget(pages, folders, 'overview')).toBe('/analytics');
    expect(navigationTarget(pages, folders, 'reportsIndex')).toBe('/analytics/reports');
  });

  it('goes home for the home page, and takes anything that is not a page as the path it is', () => {
    expect(navigationTarget(pages, folders, 'home')).toBe('/');
    expect(navigationTarget(pages, folders, '/somewhere/else')).toBe('/somewhere/else');
  });
});
