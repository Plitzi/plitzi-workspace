import { describe, it, expect, vi, beforeEach } from 'vitest';

import { renderSSR } from './handler';
import { createMemoryDraftStore, takeDraftOverride } from './preview';
import { PREVIEW_COOKIE } from '../../core/previewToken';

import type { ServerCaches } from '../../helpers/cache';
import type { PluginManager } from '../../plugins/manager';
import type {
  OfflineDataRaw,
  SSRPageServerConfig,
  SSRRequest,
  SSRResponseHelpers,
  SSRServerConfig
} from '@plitzi/sdk-shared';

/**
 * A draft is unsaved work being looked at, and everything asserted here follows from that one sentence: it must not
 * be billed, must not be cached, must not be indexed, and — the part that is new — must survive being reloaded, or
 * nobody can iterate against it.
 */

vi.mock('./buildBody', () => ({
  buildBody: () => Promise.resolve({ body: '<html>draft</html>', result: {} })
}));

const draft = { schema: { flat: {} }, style: {} } as unknown as OfflineDataRaw;

const meter = vi.fn().mockResolvedValue({ degrade: false });

const request = (query: Record<string, string> = {}, cookie?: string): SSRRequest =>
  ({
    method: 'GET',
    path: '/',
    protocol: 'https',
    headers: cookie ? { cookie } : {},
    query,
    ctx: { spaceDeployment: { spaceId: 42, environment: 'production', revision: 3 } }
  }) as unknown as SSRRequest;

const response = () => {
  const headers: Record<string, string | string[]> = {};

  return {
    headers,
    res: {
      setHeader: (name: string, value: string | string[]) => {
        headers[name] = value;
      },
      send: () => undefined
    } as unknown as SSRResponseHelpers
  };
};

const render = (req: SSRRequest, res: SSRResponseHelpers, config: SSRPageServerConfig) =>
  renderSSR(
    req,
    res,
    config,
    () => '<html>templated</html>',
    {} as PluginManager,
    {
      html: undefined,
      offlineData: undefined
    } as unknown as ServerCaches
  );

const configWith = (store: ReturnType<typeof createMemoryDraftStore>): SSRPageServerConfig =>
  ({
    adapters: { meter },
    devMode: false,
    draftStore: store,
    preview: { enabled: true, sessionTtlMs: 900_000 }
  }) as unknown as SSRPageServerConfig;

beforeEach(() => vi.clearAllMocks());

describe('the draft store', () => {
  it('spends a one-shot token on the render that uses it', async () => {
    const store = createMemoryDraftStore();
    await store.put('once', draft, { ttlMs: 60_000 });

    expect(await store.take('once')).toMatchObject({ reusable: false });
    expect(await store.take('once')).toBeUndefined();
  });

  /** The whole point of a session: the second look has to work, or "iterate" means "mint another token". */
  it('leaves a reusable token where it is', async () => {
    const store = createMemoryDraftStore();
    await store.put('session', draft, { ttlMs: 60_000, reusable: true });

    expect(await store.take('session')).toMatchObject({ reusable: true });
    expect(await store.take('session')).toMatchObject({ reusable: true });
  });

  it('ends a session when it is dropped', async () => {
    const store = createMemoryDraftStore();
    await store.put('session', draft, { ttlMs: 60_000, reusable: true });
    await store.drop('session');

    expect(await store.take('session')).toBeUndefined();
  });

  it('stops resolving a session once it has expired', async () => {
    const store = createMemoryDraftStore();
    await store.put('session', draft, { ttlMs: -1, reusable: true });

    expect(await store.take('session')).toBeUndefined();
  });
});

describe('resolving which draft a request is looking at', () => {
  const config = (store: ReturnType<typeof createMemoryDraftStore>) =>
    ({ draftStore: store }) as unknown as SSRServerConfig;

  it('reads the token from the query', async () => {
    const store = createMemoryDraftStore();
    await store.put('tok', draft, { ttlMs: 60_000, reusable: true });

    expect(await takeDraftOverride(request({ __pt: 'tok' }), config(store))).toMatchObject({ token: 'tok' });
  });

  /** The request that matters: a link followed inside a preview carries no query param, only the cookie. */
  it('falls back to the session cookie', async () => {
    const store = createMemoryDraftStore();
    await store.put('tok', draft, { ttlMs: 60_000, reusable: true });

    const resolved = await takeDraftOverride(request({}, `${PREVIEW_COOKIE}=tok`), config(store));

    expect(resolved?.data).toBe(draft);
  });

  /** Starting a new preview while an older cookie is still around has to show the NEW draft. */
  it('prefers the query param over the cookie', async () => {
    const store = createMemoryDraftStore();
    const newer = { ...draft };
    await store.put('old', draft, { ttlMs: 60_000, reusable: true });
    await store.put('new', newer, { ttlMs: 60_000, reusable: true });

    const resolved = await takeDraftOverride(request({ __pt: 'new' }, `${PREVIEW_COOKIE}=old`), config(store));

    expect(resolved?.token).toBe('new');
  });

  it('renders persisted state when the token is gone', async () => {
    const store = createMemoryDraftStore();

    expect(await takeDraftOverride(request({ __pt: 'expired' }), config(store))).toBeUndefined();
  });
});

describe('rendering a draft', () => {
  it('remembers a session for the rest of the visit, and says the page must not travel', async () => {
    const store = createMemoryDraftStore();
    await store.put('session', draft, { ttlMs: 900_000, reusable: true });
    const { res, headers } = response();

    await render(request({ __pt: 'session' }), res, configWith(store));

    expect(headers['Set-Cookie']).toContain(`${PREVIEW_COOKIE}=session`);
    expect(headers['Set-Cookie']).toContain('HttpOnly');
    expect(headers['Set-Cookie']).toContain('Secure');
    expect(headers['Cache-Control']).toBe('no-store, no-cache, must-revalidate');
    expect(headers['X-Robots-Tag']).toBe('noindex, nofollow');
  });

  /** A one-shot token is spent by this very render, so a cookie holding it would send every later request looking
   *  for something that is already gone. */
  it('does not remember a one-shot token', async () => {
    const store = createMemoryDraftStore();
    await store.put('once', draft, { ttlMs: 60_000 });
    const { res, headers } = response();

    await render(request({ __pt: 'once' }), res, configWith(store));

    expect(headers['Set-Cookie']).toBeUndefined();
    expect(headers['Cache-Control']).toBe('no-store, no-cache, must-revalidate');
  });

  /** Nobody is billed for looking at their own unsaved edits — including on the reloads a session makes possible. */
  it('is never metered', async () => {
    const store = createMemoryDraftStore();
    await store.put('session', draft, { ttlMs: 900_000, reusable: true });

    await render(request({ __pt: 'session' }), response().res, configWith(store));
    await render(request({}, `${PREVIEW_COOKIE}=session`), response().res, configWith(store));

    expect(meter).not.toHaveBeenCalled();
  });
});
