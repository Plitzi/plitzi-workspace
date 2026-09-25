import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderSSR } from './handler';
import { TtlCache } from '../../helpers/cache';

import type { ServerCaches } from '../../helpers/cache';
import type { PluginManager } from '../../plugins/manager';
import type { SSRPageServerConfig, SSRRenderResult, SSRRequest, SSRResponseHelpers, SSRUser } from '@plitzi/sdk-shared';

/**
 * What the page server does with the page's own decision about who may see it.
 *
 * The decision is taken during the React render (the SDK's navigation writes `redirect` onto the render result when a
 * signed-in visitor asks for a guest page, or a guest for a signed-in one), so the render itself is stubbed down to
 * that result: these are about the response it becomes, and about the cache never handing one visitor's answer to
 * another.
 */
type Rendered = { body?: string; result: SSRRenderResult; cacheable: boolean };

const buildBody = vi.fn<() => Promise<Rendered>>();

vi.mock('./buildBody', () => ({ buildBody: () => buildBody() }));
vi.mock('./preview', () => ({
  takeDraftOverride: () => Promise.resolve(undefined),
  draftSessionCookie: () => ''
}));

const signedIn = { id: 1, username: 'ada', token: 'session-token' } as SSRUser;

const request = (user?: SSRUser): SSRRequest =>
  ({
    method: 'GET',
    path: '/sign-in',
    search: '',
    hostname: 'site.test',
    headers: {},
    query: {},
    ctx: { user, spaceDeployment: { spaceId: 42, environment: 'production', revision: 3 } }
  }) as unknown as SSRRequest;

const response = () => {
  const sent: string[] = [];
  const headers: Record<string, string | string[]> = {};
  let status = 200;

  return {
    sent,
    headers,
    status: () => status,
    res: {
      setHeader: (name: string, value: string | string[]) => {
        headers[name] = value;
      },
      setStatus: (code: number) => {
        status = code;
      },
      send: (body: string) => sent.push(body)
    } as unknown as SSRResponseHelpers
  };
};

const config = { adapters: {}, devMode: false } as unknown as SSRPageServerConfig;

const caches = (html?: TtlCache<string>) => ({ html, offlineData: undefined }) as unknown as ServerCaches;

const render = (req: SSRRequest, res: SSRResponseHelpers, html?: TtlCache<string>) =>
  renderSSR(req, res, config, () => '', {} as PluginManager, caches(html));

const page = (body: string): Rendered => ({ body, result: {}, cacheable: true });

const redirect = (to: string, status?: number): Rendered => ({ result: { redirect: to, status }, cacheable: true });

beforeEach(() => {
  buildBody.mockReset();
});

describe('a page the visitor may not see', () => {
  it('answers with a redirect before any HTML, when a signed-in visitor asks for a guest page', async () => {
    buildBody.mockResolvedValue(redirect('/analytics/dashboard'));
    const { res, sent, headers, status } = response();

    await render(request(signedIn), res);

    expect(status()).toBe(302);
    expect(headers['Location']).toBe('/analytics/dashboard');
    expect(sent).toEqual(['']);
  });

  it('keeps the status the page asked for', async () => {
    buildBody.mockResolvedValue(redirect('/sign-in', 307));
    const { res, status } = response();

    await render(request(), res);

    expect(status()).toBe(307);
  });

  // A redirect is an answer about THIS visitor. Cached, the next visitor with the same key would be bounced without
  // the page ever being asked again — and it is the page that knows whether they should be.
  it('is never cached', async () => {
    const cache = new TtlCache<string>(60_000, 10);
    buildBody
      .mockResolvedValueOnce(redirect('/analytics/dashboard'))
      .mockResolvedValueOnce(page('<html>sign in</html>'));

    await render(request(signedIn), response().res, cache);
    const second = response();
    await render(request(signedIn), second.res, cache);

    expect(buildBody).toHaveBeenCalledTimes(2);
    expect(second.sent).toEqual(['<html>sign in</html>']);
  });
});

/**
 * One address rendered for a guest and for a signed-in visitor is two different pages — the landing and the home, or
 * a guest page and a redirect away from it. The cache keys on the session, so neither is ever served the other's.
 */
describe('one address, two visitors', () => {
  it('does not serve a guest’s cached page to a signed-in visitor', async () => {
    const cache = new TtlCache<string>(60_000, 10);
    buildBody
      .mockResolvedValueOnce(page('<html>landing</html>'))
      .mockResolvedValueOnce(redirect('/analytics/dashboard'));

    await render(request(), response().res, cache);
    const signedInResponse = response();
    await render(request(signedIn), signedInResponse.res, cache);

    expect(buildBody).toHaveBeenCalledTimes(2);
    expect(signedInResponse.status()).toBe(302);
    expect(signedInResponse.headers['Location']).toBe('/analytics/dashboard');
  });

  it('does not serve a signed-in visitor’s cached page to a guest', async () => {
    const cache = new TtlCache<string>(60_000, 10);
    buildBody.mockResolvedValueOnce(page('<html>home</html>')).mockResolvedValueOnce(page('<html>landing</html>'));

    await render(request(signedIn), response().res, cache);
    const guest = response();
    await render(request(), guest.res, cache);

    expect(guest.sent).toEqual(['<html>landing</html>']);
  });
});
