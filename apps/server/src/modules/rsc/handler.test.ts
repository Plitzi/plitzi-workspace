import { describe, expect, it } from 'vitest';

import { withPageLocation } from './handler';

import type { SSRRequest } from '@plitzi/sdk-shared';

const request = (query: Record<string, string>): SSRRequest => ({
  method: 'GET',
  path: '/_rsc',
  search: `?${new URLSearchParams(query).toString()}`,
  url: `/_rsc?${new URLSearchParams(query).toString()}`,
  hostname: 'example.test',
  protocol: 'https',
  headers: {},
  query,
  ctx: {}
});

describe('withPageLocation', () => {
  it('resolves the page the browser is on, with its own query', () => {
    const page = withPageLocation(request({ location: '/blog/post?tab=comments', ids: 'list' }));

    expect(page.path).toBe('/blog/post');
    expect(page.query).toEqual({ tab: 'comments' });
  });

  it('reads what a refresh asks for — the next page, a search — over the location’s own query', () => {
    const page = withPageLocation(request({ location: '/?page=1', ids: 'gallery', page: '3', q: 'retro' }));

    expect(page.query).toEqual({ page: '3', q: 'retro' });
    expect(page.url).toBe('/?page=3&q=retro');
  });

  it('never hands the endpoint’s own parameters on as input', () => {
    const page = withPageLocation(request({ location: '/', ids: 'gallery' }));

    expect(page.query).toEqual({});
    expect(page.search).toBe('');
  });
});
