import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleRsc, withPageLocation } from './handler';
import { TtlCache } from '../../helpers/cache/TtlCache';

import type { PluginManager } from '../../plugins/manager';
import type { SSRPageServerConfig, SSRRequest, SSRResponseHelpers } from '@plitzi/sdk-shared';

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

describe('handleRsc', () => {
  const caches: TtlCache<string>[] = [];

  afterEach(() => {
    caches.splice(0).forEach(cache => cache.destroy());
  });

  const live = (headers: SSRRequest['headers'] = {}): SSRRequest => ({
    ...request({ location: '/', ids: 'list' }),
    headers,
    ctx: { spaceDeployment: { spaceId: 3, environment: 'production', revision: 1 } }
  });

  const answer = async (req: SSRRequest, config: SSRPageServerConfig, cache: TtlCache<string>) => {
    const sent: { body: string; headers: Record<string, string | string[]> } = { body: '', headers: {} };
    const res: SSRResponseHelpers = {
      status: 200,
      headers: {},
      setHeader: (name, value) => {
        sent.headers[name] = value;
      },
      setStatus: () => undefined,
      send: body => {
        sent.body = typeof body === 'string' ? body : body.toString('utf-8');
      },
      write: () => undefined,
      end: () => undefined
    };
    // The handler never reads its plugin manager; a test has none to give it.
    await handleRsc(req, res, config, {} as PluginManager, cache);

    return sent;
  };

  const setup = () => {
    let count = 0;
    const getRscData = vi.fn(() => Promise.resolve({ serverData: { list: ++count } }));
    // Only the adapters `/_rsc` calls: the rest of a page server's configuration plays no part in a refresh.
    const config = {
      adapters: { getRscData, getOfflineData: () => Promise.resolve(undefined) }
    } as unknown as SSRPageServerConfig;
    const cache = new TtlCache<string>(30_000);
    caches.push(cache);

    return { config, cache, getRscData };
  };

  it('answers the same question from its cache until it expires', async () => {
    const { config, cache, getRscData } = setup();

    await answer(live(), config, cache);
    const second = await answer(live(), config, cache);

    expect(getRscData).toHaveBeenCalledTimes(1);
    expect(second.headers['X-Cache']).toBe('HIT');
  });

  /** A refresh after a write: answered from the cache, it was the slice from before the write for up to `cacheTtlMs`. */
  it('resolves again for a request asking for no-cache, and keeps that answer for the next one', async () => {
    const { config, cache, getRscData } = setup();

    await answer(live(), config, cache);
    const fresh = await answer(live({ 'cache-control': 'max-age=0, no-cache' }), config, cache);
    const after = await answer(live(), config, cache);

    expect(getRscData).toHaveBeenCalledTimes(2);
    expect(fresh.headers['X-Cache']).toBe('MISS');
    expect(JSON.parse(fresh.body)).toMatchObject({ serverData: { list: 2 } });
    expect(after.headers['X-Cache']).toBe('HIT');
    expect(JSON.parse(after.body)).toMatchObject({ serverData: { list: 2 } });
  });
});
