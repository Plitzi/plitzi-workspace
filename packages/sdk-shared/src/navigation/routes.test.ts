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

/**
 * Which page a visitor gets, decided from `authenticated` — once on the server, which answers with a 302 or the page,
 * and again in the browser, which must reach the same answer or the page it hydrates is not the one it shows.
 *
 * `public` is a GUEST page, not "anyone": a signed-in visitor is refused it, and sent on where the page says.
 */
describe('who may see a page', () => {
  const access: Record<string, Element> = {
    home: page('home', { slug: '', default: true }),
    signIn: page('signIn', {
      slug: 'sign-in',
      accessLevel: 'public',
      unauthorizedBehaviour: 'redirect',
      unauthorizedPageRedirect: 'dashboard'
    }),
    dashboard: page('dashboard', {
      slug: 'dashboard',
      folder: 'analytics',
      accessLevel: 'authenticated',
      unauthorizedBehaviour: 'redirect',
      unauthorizedPageRedirect: 'signIn'
    }),
    welcome: page('welcome', { slug: 'welcome', accessLevel: 'public' }),
    account: page('account', {
      slug: 'account',
      accessLevel: 'authenticated',
      unauthorizedBehaviour: 'redirect',
      unauthorizedPageRedirect: '{{authUrl}}/'
    })
  };

  const match = (pathName: string, authenticated: boolean, previewMode = true) =>
    matchRoutePath(getPaths(access, folders, authenticated, '', previewMode), pathName, authenticated);

  it('sends a signed-in visitor away from a guest page, to the full path of the page it names', () => {
    expect(match('/sign-in', true).action).toEqual({ type: 'redirect', path: '/analytics/dashboard' });
  });

  it('shows a guest page to a guest', () => {
    expect(match('/sign-in', false)).toMatchObject({ action: { type: 'normal' }, pageId: 'signIn' });
  });

  it('refuses a guest page that names nowhere to go, rather than showing it to a signed-in visitor', () => {
    expect(match('/welcome', true).action).toEqual({ type: 'accessDenied', path: undefined });
    expect(match('/welcome', false)).toMatchObject({ action: { type: 'normal' }, pageId: 'welcome' });
  });

  it('sends a guest away from a signed-in page, and lets a signed-in visitor through', () => {
    expect(match('/analytics/dashboard', false).action).toEqual({ type: 'redirect', path: '/sign-in' });
    expect(match('/analytics/dashboard', true)).toMatchObject({ action: { type: 'normal' }, pageId: 'dashboard' });
  });

  // Resolved by the provider against the space's variables; run through the page resolver it became `/{{authUrl}}`.
  it('keeps an off-site destination as written, for the provider to resolve', () => {
    expect(match('/account', false).action).toEqual({ type: 'redirect', path: '{{authUrl}}/' });
  });

  it('opens every page in the builder, where nobody is being kept out', () => {
    expect(match('/sign-in', true, false)).toMatchObject({ action: { type: 'normal' }, pageId: 'signIn' });
    expect(match('/analytics/dashboard', false, false)).toMatchObject({
      action: { type: 'normal' },
      pageId: 'dashboard'
    });
  });

  /**
   * One address, two pages: the guest's landing and the signed-in home. Neither redirects — the address picks between
   * them — so what decides the page is `authenticated` alone, and the server and the browser have to agree on it.
   */
  it('picks between two pages at one address without redirecting either visitor', () => {
    const shared: Record<string, Element> = {
      landing: page('landing', {
        slug: '',
        default: true,
        accessLevel: 'public',
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: 'app'
      }),
      app: page('app', {
        slug: '',
        accessLevel: 'authenticated',
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '{{authUrl}}/'
      })
    };
    const at = (authenticated: boolean) => matchRoutePath(getPaths(shared, [], authenticated), '/', authenticated);

    expect(at(false)).toMatchObject({ action: { type: 'normal' }, pageId: 'landing' });
    expect(at(true)).toMatchObject({ action: { type: 'normal' }, pageId: 'app' });
  });
});
