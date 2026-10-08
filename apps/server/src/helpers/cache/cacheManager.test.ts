import { afterEach, describe, expect, it } from 'vitest';

import { buildCacheManager } from './cacheManager';
import { buildHtmlCacheKey, buildOfflineDataCacheKey, buildRscCacheKey } from './keys';
import { createServerCaches, destroyServerCaches } from './serverCaches';

import type { ServerCaches } from './serverCaches';

/**
 * `server.cache` over keys written the way a render writes them. The filter read the key by positions of its own, and
 * when the key grew fields in front of the space id every invalidation by space, environment or host matched nothing
 * — a publish webhook that cleared no page, and no error anywhere.
 */

const made: ServerCaches[] = [];

const request = (hostname: string, cookie?: string) => ({
  hostname,
  path: '/pricing',
  search: '?plan=pro',
  headers: { cookie, host: hostname }
});

const page = (
  spaceId: number,
  environment: string,
  hostname: string,
  { token, cookie }: { token?: string; cookie?: string } = {}
): string => buildHtmlCacheKey(token, spaceId, environment, 3, request(hostname, cookie));

const pagesOf = (keys: string[]) => {
  const caches = createServerCaches(60_000, 60_000);
  made.push(caches);
  keys.forEach(key => caches.html?.set(key, { html: '<html></html>', compressed: {} }));

  return { caches, manager: buildCacheManager(caches) };
};

afterEach(() => {
  made.splice(0).forEach(destroyServerCaches);
});

describe('buildCacheManager', () => {
  const keys = [
    page(42, 'production', 'a.example'),
    page(42, 'production', 'a.example', { token: 'signed-in', cookie: 'theme=dark' }),
    page(42, 'staging', 'b.example'),
    page(7, 'production', 'a.example')
  ];

  it('drops every page of a space, whoever it was rendered for and in whichever theme', () => {
    const { caches, manager } = pagesOf(keys);

    expect(manager.invalidate({ spaceId: 42 })).toBe(3);
    expect(caches.html?.size).toBe(1);
  });

  it('narrows by environment and host, together', () => {
    const { manager } = pagesOf(keys);

    expect(manager.invalidate({ spaceId: 42, environment: 'production' })).toBe(2);
    expect(manager.invalidate({ hostname: 'a.example' })).toBe(1);
    expect(manager.size).toBe(1);
  });

  it('matches nothing that is not there', () => {
    const { manager } = pagesOf(keys);

    expect(manager.invalidate({ spaceId: 99 })).toBe(0);
    expect(manager.invalidate({ environment: 'main' })).toBe(0);
    expect(manager.size).toBe(4);
  });

  it('clears everything with no filter', () => {
    const { manager } = pagesOf(keys);

    expect(manager.invalidate()).toBe(4);
    expect(manager.size).toBe(0);
  });

  /**
   * A page dropped while the space it was rendered from stayed was rendered again from that space: a publish that
   * invalidated the space cleared every page and changed none of them, until the space's own TTL ran out.
   */
  it('drops the space a page is rendered from and its RSC answers with the page', () => {
    const { caches, manager } = pagesOf([page(42, 'production', 'a.example'), page(7, 'production', 'a.example')]);
    caches.offlineData?.set(buildOfflineDataCacheKey(42, 'production', 0, 'flags'), '{}');
    caches.offlineData?.set(buildOfflineDataCacheKey(7, 'production', 0, 'flags'), '{}');
    caches.rsc?.set(buildRscCacheKey(42, 'production', 0, undefined, undefined, request('a.example')), '{}');

    expect(manager.invalidate({ spaceId: 42, environment: 'production' })).toBe(3);
    expect(caches.html?.size).toBe(1);
    expect(caches.offlineData?.size).toBe(1);
    expect(caches.rsc?.size).toBe(0);
  });

  it('drops the space a host is rendered from when the host is invalidated, and the other host’s pages stay', () => {
    const { caches, manager } = pagesOf([page(42, 'production', 'a.example'), page(42, 'production', 'b.example')]);
    caches.offlineData?.set(buildOfflineDataCacheKey(42, 'production', 0, 'flags'), '{}');

    expect(manager.invalidate({ hostname: 'a.example' })).toBe(2);
    expect(caches.html?.size).toBe(1);
    expect(caches.offlineData?.size).toBe(0);
  });

  it('clears and counts all three', () => {
    const { caches, manager } = pagesOf([page(42, 'production', 'a.example')]);
    caches.offlineData?.set(buildOfflineDataCacheKey(42, 'production', 0, ''), '{}');
    caches.rsc?.set(buildRscCacheKey(42, 'production', 0, 5, 'el1', request('a.example')), '{}');

    expect(manager.size).toBe(3);

    manager.clear();

    expect(manager.size).toBe(0);
  });
});
