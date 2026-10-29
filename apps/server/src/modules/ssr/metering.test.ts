import { describe, it, expect, vi, beforeEach } from 'vitest';

import { renderSSR } from './handler';
import { TtlCache } from '../../helpers/cache';

import type { ServerCaches } from '../../helpers/cache';
import type { PluginManager } from '../../plugins/manager';
import type {
  MeteredKind,
  SSRMeterDecision,
  SSRPageServerConfig,
  SSRRequest,
  SSRResponseHelpers
} from '@plitzi/sdk-shared';

// The render pipeline is not what these tests are about: they are about WHEN the metering adapter is called
// and what it is told, so everything past it is stubbed down to a body.
vi.mock('./buildBody', () => ({
  buildBody: () => Promise.resolve({ body: '<html>fresh</html>', result: {}, cacheable: true })
}));
vi.mock('./preview', () => ({
  takeDraftOverride: () => Promise.resolve(undefined),
  draftSessionCookie: () => ''
}));

const meter = vi.fn<(event: { kind: MeteredKind; cached: boolean }) => Promise<SSRMeterDecision | undefined>>();

const callAt = (call: number) => meter.mock.calls[call][0];

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

const config = (): SSRPageServerConfig => ({ adapters: { meter }, devMode: false }) as unknown as SSRPageServerConfig;

const caches = (html?: TtlCache<string>): ServerCaches => ({ html, offlineData: undefined }) as unknown as ServerCaches;

const render = (req: SSRRequest, res: SSRResponseHelpers, serverCaches: ServerCaches) =>
  renderSSR(req, res, config(), () => '<html>templated</html>', {} as PluginManager, serverCaches);

beforeEach(() => {
  vi.clearAllMocks();
  meter.mockResolvedValue({ degrade: false });
});

describe('SSR page metering', () => {
  it('reports a rendered page as a page view that reached the origin', async () => {
    const { res } = response();
    await render(request(), res, caches());

    expect(meter).toHaveBeenCalledOnce();
    expect(callAt(0)).toMatchObject({ kind: 'page_view', cached: false });
  });

  // The reason metering does not sit behind the cache lookup: a space would stop being metered exactly when it
  // got popular enough to be cached. It is reported as cached, which is what the plan prices differently.
  it('still reports a page served from the HTML cache, flagged as cached', async () => {
    const cache = new TtlCache<string>(60_000, 10);
    const { res, sent } = response();

    await render(request(), res, caches(cache));
    expect(callAt(0).cached).toBe(false);

    const second = response();
    await render(request(), second.res, caches(cache));

    expect(second.sent[0]).toBe(sent[0]);
    expect(meter).toHaveBeenCalledTimes(2);
    expect(callAt(1)).toMatchObject({ kind: 'page_view', cached: true });
  });

  it('publishes the adapter decision to the render', async () => {
    meter.mockResolvedValue({ degrade: true, analytics: { endpoint: 'https://api.test/v1/collect', key: 'k' } });
    const req = request();

    await render(req, response().res, caches());

    expect(req.ctx.meter?.degrade).toBe(true);
    expect(req.ctx.meter?.analytics?.key).toBe('k');
  });

  // A free sub-domain is no place to host a site: kept out of search results, fresh or from the cache alike.
  it('sends noindex when the adapter says the address is not one sites are hosted on', async () => {
    meter.mockResolvedValue({ noindex: true, badge: true });
    const cache = new TtlCache<string>(60_000, 10);
    const req = request();
    const fresh = response();

    await render(req, fresh.res, caches(cache));
    expect(fresh.headers['X-Robots-Tag']).toBe('noindex, nofollow');
    expect(req.ctx.meter?.badge).toBe(true);

    const cached = response();
    await render(request(), cached.res, caches(cache));
    expect(cached.headers['X-Robots-Tag']).toBe('noindex, nofollow');

    meter.mockResolvedValue({});
    const indexed = response();
    await render(request(), indexed.res, caches());
    expect(indexed.headers['X-Robots-Tag']).toBeUndefined();
  });

  // A free site whose owner never confirmed their email is held back: a notice, never the space, cached or not.
  it('answers 503 with the words the adapter chose when it holds the page back', async () => {
    meter.mockResolvedValue({ unavailable: 'This page is not available.' });
    const cache = new TtlCache<string>(60_000, 10);
    const { res, sent, headers } = response();
    const status = vi.fn();
    (res as unknown as { setStatus: (code: number) => void }).setStatus = status;

    await render(request(), res, caches(cache));

    expect(status).toHaveBeenCalledWith(503);
    expect(headers['X-Robots-Tag']).toBe('noindex, nofollow');
    expect(headers['Cache-Control']).toBe('no-store');
    expect(sent[0]).toContain('This page is not available.');
    expect(sent[0]).not.toContain('fresh');
  });

  // Metering must never be able to fail a render.
  it('serves the page when the metering adapter throws', async () => {
    meter.mockRejectedValue(new Error('store down'));
    const { res, sent } = response();
    const req = request();

    await render(req, res, caches());

    expect(sent[0]).toBe('<html>fresh</html>');
    expect(req.ctx.meter).toBeUndefined();
  });
});
