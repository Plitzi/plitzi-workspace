import { afterEach, describe, expect, it } from 'vitest';

import { buildCacheManager } from './cacheManager';
import { buildHtmlCacheKey } from './keys';
import { TtlCache } from './TtlCache';

/**
 * `server.cache` over keys written the way a render writes them. The filter read the key by positions of its own, and
 * when the key grew fields in front of the space id every invalidation by space, environment or host matched nothing
 * — a publish webhook that cleared no page, and no error anywhere.
 */

const stores: TtlCache<string>[] = [];

const page = (
  spaceId: number,
  environment: string,
  hostname: string,
  { token, cookie }: { token?: string; cookie?: string } = {}
): string =>
  buildHtmlCacheKey(token, spaceId, environment, 3, {
    hostname,
    path: '/pricing',
    search: '?plan=pro',
    headers: { cookie, host: hostname }
  });

const cacheOf = (keys: string[]) => {
  const store = new TtlCache<string>(60_000);
  stores.push(store);
  keys.forEach(key => store.set(key, '<html></html>'));

  return { store, manager: buildCacheManager(store) };
};

afterEach(() => {
  stores.splice(0).forEach(store => store.destroy());
});

describe('buildCacheManager', () => {
  const keys = [
    page(42, 'production', 'a.example'),
    page(42, 'production', 'a.example', { token: 'signed-in', cookie: 'theme=dark' }),
    page(42, 'staging', 'b.example'),
    page(7, 'production', 'a.example')
  ];

  it('drops every page of a space, whoever it was rendered for and in whichever theme', () => {
    const { store, manager } = cacheOf(keys);

    expect(manager.invalidate({ spaceId: 42 })).toBe(3);
    expect(store.size).toBe(1);
  });

  it('narrows by environment and host, together', () => {
    const { manager } = cacheOf(keys);

    expect(manager.invalidate({ spaceId: 42, environment: 'production' })).toBe(2);
    expect(manager.invalidate({ hostname: 'a.example' })).toBe(1);
    expect(manager.size).toBe(1);
  });

  it('matches nothing that is not there', () => {
    const { manager } = cacheOf(keys);

    expect(manager.invalidate({ spaceId: 99 })).toBe(0);
    expect(manager.invalidate({ environment: 'main' })).toBe(0);
    expect(manager.size).toBe(4);
  });

  it('clears everything with no filter', () => {
    const { manager } = cacheOf(keys);

    expect(manager.invalidate()).toBe(4);
    expect(manager.size).toBe(0);
  });
});
