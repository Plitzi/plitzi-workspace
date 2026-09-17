import { describe, expect, it } from 'vitest';

import { getPageFullPath, getPaths, matchRoutePath } from './routes';

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
});
