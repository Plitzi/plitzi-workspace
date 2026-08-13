import { describe, it, expect, vi, beforeEach } from 'vitest';

import { renderSSR } from './handler';
import { TtlCache } from '../../helpers/cache';

import type { ServerCaches } from '../../helpers/cache';
import type { PluginManager } from '../../plugins/manager';
import type { SSRPageServerConfig, SSRPageView, SSRRequest, SSRResponseHelpers } from '@plitzi/sdk-shared';

// The render pipeline is not what these tests are about: they are about WHEN the metering adapter is called
// and what it is told, so everything past it is stubbed down to a body.
vi.mock('./buildBody', () => ({
  buildBody: () => Promise.resolve({ body: '<html>fresh</html>', result: {} })
}));
vi.mock('./preview', () => ({ takeDraftOverride: () => Promise.resolve(undefined) }));

const pageView = vi.fn<(context: { cached: boolean }) => Promise<SSRPageView | undefined>>();

const request = (): SSRRequest =>
  ({
    method: 'GET',
    path: '/',
    headers: {},
    query: {},
    ctx: { spaceDeployment: { spaceId: 42, environment: 'production', revision: 3 } }
  }) as unknown as SSRRequest;

const response = () => {
  const sent: string[] = [];
  const headers: Record<string, string | string[]> = {};

  return {
    sent,
    headers,
    res: {
      setHeader: (name: string, value: string | string[]) => {
        headers[name] = value;
      },
      send: (body: string) => sent.push(body)
    } as unknown as SSRResponseHelpers
  };
};

const config = (): SSRPageServerConfig =>
  ({ adapters: { pageView }, devMode: false }) as unknown as SSRPageServerConfig;

const caches = (html?: TtlCache<string>): ServerCaches => ({ html, offlineData: undefined }) as unknown as ServerCaches;

const render = (req: SSRRequest, res: SSRResponseHelpers, serverCaches: ServerCaches) =>
  renderSSR(req, res, config(), () => '<html>templated</html>', {} as PluginManager, serverCaches);

beforeEach(() => {
  vi.clearAllMocks();
  pageView.mockResolvedValue({ degrade: false });
});

describe('SSR page-view metering', () => {
  it('counts a rendered page as a full view', async () => {
    const { res } = response();
    await render(request(), res, caches());

    expect(pageView).toHaveBeenCalledOnce();
    expect(pageView.mock.calls[0][0].cached).toBe(false);
  });

  // The reason metering does not sit behind the cache lookup: a space would stop being metered exactly when it
  // got popular enough to be cached.
  it('still counts a page served from the HTML cache, and says it was cached', async () => {
    const cache = new TtlCache<string>(60_000, 10);
    const { res, sent } = response();

    await render(request(), res, caches(cache));
    expect(pageView.mock.calls[0][0].cached).toBe(false);

    const second = response();
    await render(request(), second.res, caches(cache));

    expect(second.sent[0]).toBe(sent[0]);
    expect(pageView).toHaveBeenCalledTimes(2);
    expect(pageView.mock.calls[1][0].cached).toBe(true);
  });

  it('publishes the adapter decision to the render', async () => {
    pageView.mockResolvedValue({ degrade: true, analytics: { endpoint: 'https://api.test/v1/collect', key: 'k' } });
    const req = request();

    await render(req, response().res, caches());

    expect(req.ctx.pageView?.degrade).toBe(true);
    expect(req.ctx.pageView?.analytics?.key).toBe('k');
  });

  // Metering must never be able to fail a render.
  it('serves the page when the metering adapter throws', async () => {
    pageView.mockRejectedValue(new Error('store down'));
    const { res, sent } = response();
    const req = request();

    await render(req, res, caches());

    expect(sent[0]).toBe('<html>fresh</html>');
    expect(req.ctx.pageView).toBeUndefined();
  });
});
