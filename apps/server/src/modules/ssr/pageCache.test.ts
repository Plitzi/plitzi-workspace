import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderSSR } from './handler';
import { createServerCaches, destroyServerCaches, keepPage, toSharedPage } from '../../helpers/cache';
import { DEFAULT_COMPRESSION } from '../../helpers/compress';

import type { ServerCaches } from '../../helpers/cache';
import type { PluginManager } from '../../plugins/manager';
import type {
  SharedPage,
  SharedPageStore,
  SSRPageServerConfig,
  SSRRenderResult,
  SSRRequest,
  SSRResponseHelpers,
  SSRUser
} from '@plitzi/sdk-shared';

type Rendered = { body?: string; result: SSRRenderResult; cacheable: boolean };

const buildBody = vi.fn<(req: SSRRequest) => Promise<Rendered>>();

vi.mock('./buildBody', () => ({ buildBody: (req: SSRRequest) => buildBody(req) }));
vi.mock('./preview', () => ({
  takeDraftOverride: () => Promise.resolve(undefined),
  draftSessionCookie: () => ''
}));

const request = (search = '', user?: SSRUser): SSRRequest =>
  ({
    method: 'GET',
    path: '/',
    search,
    hostname: 'site.test',
    headers: {},
    query: Object.fromEntries(new URLSearchParams(search)),
    ctx: { user, spaceDeployment: { spaceId: 42, environment: 'production', revision: 3 } }
  }) as unknown as SSRRequest;

const response = () => {
  const sent: string[] = [];
  const headers: Record<string, string> = {};

  return {
    sent,
    headers,
    res: {
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
      setStatus: () => undefined,
      send: (body: string | (() => string)) => sent.push(typeof body === 'function' ? body() : body)
    } as unknown as SSRResponseHelpers
  };
};

const page = (body: string): Rendered => ({ body, result: {}, cacheable: true });

const made: ServerCaches[] = [];
const caches = (staleMs = 60_000): ServerCaches => {
  const created = createServerCaches({ htmlTtlMs: 1_000, staleMs });
  made.push(created);

  return created;
};

const render = (req: SSRRequest, res: SSRResponseHelpers, serverCaches: ServerCaches, config: object = {}) =>
  renderSSR(
    req,
    res,
    { adapters: {}, devMode: false, cacheTtlMs: 1_000, ...config } as unknown as SSRPageServerConfig,
    () => '',
    {} as PluginManager,
    serverCaches
  );

beforeEach(() => {
  buildBody.mockReset();
});

afterEach(() => {
  made.splice(0).forEach(destroyServerCaches);
  vi.useRealTimers();
});

/**
 * The draft (`main`) is being edited right then: a page of it is kept only under the version every edit changes, so a
 * write is never answered with the page drawn before it — and never at all when the deployment cannot say the version.
 */
describe('the page cache for the draft', () => {
  const draft = (draftVersion?: string): SSRRequest => {
    const req = request();
    req.ctx.spaceDeployment = {
      spaceId: 42,
      environment: 'main',
      revision: 0,
      ...(draftVersion ? { draftVersion } : {})
    };

    return req;
  };

  it('keeps no page of a draft whose version is not known', async () => {
    buildBody.mockResolvedValue(page('<html>draft</html>'));
    const pages = caches();
    await render(draft(), response().res, pages);
    const again = response();
    await render(draft(), again.res, pages);

    expect(buildBody).toHaveBeenCalledTimes(2);
    expect(again.headers['X-Cache']).not.toBe('HIT');
  });

  it('keeps a page under the draft’s version, and draws it again for the next one', async () => {
    buildBody.mockResolvedValueOnce(page('<html>v1</html>')).mockResolvedValueOnce(page('<html>v2</html>'));
    const pages = caches();
    await render(draft('v1'), response().res, pages);
    const same = response();
    await render(draft('v1'), same.res, pages);
    const edited = response();
    await render(draft('v2'), edited.res, pages);

    expect(same.headers['X-Cache']).toBe('HIT');
    expect(same.sent).toEqual(['<html>v1</html>']);
    expect(edited.sent).toEqual(['<html>v2</html>']);
    expect(buildBody).toHaveBeenCalledTimes(2);
  });
});

describe('the page cache', () => {
  // A page a publish invalidated, asked for by every visitor in the second its render takes.
  it('renders a page once for the requests that ask for it at the same time', async () => {
    let finish: (rendered: Rendered) => void = () => undefined;
    buildBody.mockReturnValueOnce(
      new Promise(resolve => {
        finish = resolve;
      })
    );
    const pages = caches();
    const first = response();
    const second = response();

    const both = Promise.all([render(request(), first.res, pages), render(request(), second.res, pages)]);
    await vi.waitFor(() => {
      expect(buildBody).toHaveBeenCalledOnce();
    });
    finish(page('<html>home</html>'));
    await both;

    expect(buildBody).toHaveBeenCalledOnce();
    expect(first.sent).toEqual(['<html>home</html>']);
    expect(second.sent).toEqual(['<html>home</html>']);
    expect(second.headers['X-Cache']).toBe('HIT');
  });

  it('renders its own page when the one it waited for may not be kept', async () => {
    let finish: (rendered: Rendered) => void = () => undefined;
    buildBody
      .mockReturnValueOnce(
        new Promise(resolve => {
          finish = resolve;
        })
      )
      .mockResolvedValueOnce(page('<html>its own</html>'));
    const pages = caches();
    const second = response();

    const both = Promise.all([render(request(), response().res, pages), render(request(), second.res, pages)]);
    await vi.waitFor(() => {
      expect(buildBody).toHaveBeenCalledOnce();
    });
    finish({ body: '<html>runs</html>', result: {}, cacheable: false });
    await both;

    expect(buildBody).toHaveBeenCalledTimes(2);
    expect(second.sent).toEqual(['<html>its own</html>']);
  });

  // The visitor after the TTL gets the page as fast as the one before; the one after that gets the new render.
  it('serves an expired page while it renders it again behind it', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    buildBody.mockResolvedValueOnce(page('<html>old</html>')).mockResolvedValueOnce(page('<html>new</html>'));
    const pages = caches();
    await render(request(), response().res, pages);

    vi.setSystemTime(Date.now() + 1_500);
    const stale = response();
    await render(request(), stale.res, pages);

    expect(stale.sent).toEqual(['<html>old</html>']);
    expect(stale.headers['X-Cache']).toBe('STALE');
    await vi.waitFor(() => {
      expect(buildBody).toHaveBeenCalledTimes(2);
    });

    const fresh = response();
    await vi.waitFor(async () => {
      await render(request(), fresh.res, pages);
      expect(fresh.sent.at(-1)).toBe('<html>new</html>');
    });
    expect(fresh.headers['X-Cache']).toBe('HIT');
  });

  it('renders on the request that finds a page expired when told to serve nothing stale', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    buildBody.mockResolvedValueOnce(page('<html>old</html>')).mockResolvedValueOnce(page('<html>new</html>'));
    const pages = caches(0);
    await render(request(), response().res, pages, { cache: { staleMs: 0 } });

    vi.setSystemTime(Date.now() + 1_500);
    const next = response();
    await render(request(), next.res, pages, { cache: { staleMs: 0 } });

    expect(next.sent).toEqual(['<html>new</html>']);
    expect(next.headers['X-Cache']).toBe('MISS');
  });

  // A campaign link is the page everybody else sees: rendered without its analytics, and not rendered again for it.
  it('renders and keeps a page as if the analytics parameters of its link were absent', async () => {
    buildBody.mockImplementation(req => Promise.resolve(page(`<html>${JSON.stringify(req.query)}</html>`)));
    const pages = caches();
    const campaign = response();

    await render(request('?utm_source=news&q=1'), campaign.res, pages);
    const plain = response();
    await render(request('?q=1'), plain.res, pages);

    expect(buildBody).toHaveBeenCalledOnce();
    expect(campaign.sent).toEqual(['<html>{"q":"1"}</html>']);
    expect(plain.headers['X-Cache']).toBe('HIT');
  });
});

describe('the page store every replica shares', () => {
  const shared = (): SharedPageStore & { pages: Map<string, SharedPage> } => {
    const pages = new Map<string, SharedPage>();

    return {
      pages,
      get: key => Promise.resolve(pages.get(key)),
      set: (key, kept) => {
        pages.set(key, kept);

        return Promise.resolve();
      },
      invalidate: () => Promise.resolve(0)
    };
  };

  it('is given a page rendered for nobody in particular, and serves it to a replica that never rendered it', async () => {
    const store = shared();
    buildBody.mockResolvedValueOnce(page('<html>home</html>'));
    await render(request(), response().res, caches(), { cache: { store } });

    await vi.waitFor(() => {
      expect(store.pages.size).toBe(1);
    });

    const otherReplica = response();
    await render(request(), otherReplica.res, caches(), { cache: { store } });

    expect(buildBody).toHaveBeenCalledOnce();
    expect(otherReplica.sent).toEqual(['<html>home</html>']);
  });

  it('is never given a signed-in visitor’s page', async () => {
    const store = shared();
    buildBody.mockResolvedValueOnce(page('<html>yours</html>'));
    await render(request('', { id: 1, token: 'session' } as SSRUser), response().res, caches(), { cache: { store } });

    expect(store.pages.size).toBe(0);
  });

  it('is never written under a key holding what the visitor sent', async () => {
    const store = shared();
    buildBody.mockResolvedValueOnce(page('<html>home</html>'));
    await render(request(), response().res, caches(), { cache: { store } });

    await vi.waitFor(() => {
      expect([...store.pages.keys()][0]).toMatch(/^[\w-]{43}$/);
    });
  });

  it('renders the page when the store cannot answer, and says so', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = { ...shared(), get: () => Promise.reject(new Error('down')) };
    buildBody.mockResolvedValueOnce(page('<html>home</html>'));
    const res = response();

    await render(request(), res.res, caches(), { cache: { store } });

    expect(res.sent).toEqual(['<html>home</html>']);
    warn.mockRestore();
  });

  it('serves a page the store kept from an older render as stale', async () => {
    const store = shared();
    const kept = keepPage('<html>kept</html>', DEFAULT_COMPRESSION);
    buildBody.mockResolvedValueOnce(page('<html>new</html>'));
    vi.spyOn(store, 'get').mockResolvedValue(toSharedPage(kept, Date.now() - 1_500));
    const res = response();

    await render(request(), res.res, caches(), { cache: { store } });

    expect(res.sent).toEqual(['<html>kept</html>']);
    expect(res.headers['X-Cache']).toBe('STALE');
  });
});
