import { act, render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createStore } from '@plitzi/nexus';
import { StoreProvider } from '@plitzi/nexus/react';

import refreshRsc from './refreshRsc';
import useRscSync from './useRscSync';

import type { CommonState, Element, SchemaRsc, ServerSSR } from '../../types';
import type { StoreApi } from '@plitzi/nexus';

const element = (id: string, items: string[] = [], runtime?: 'server' | 'client'): Element => ({
  id,
  attributes: {},
  definition: { type: id, label: id, rootId: 'home', items, styleSelectors: { base: '' }, runtime }
});

/**
 * A space with a mix, which is the whole reason the gate exists: `blog` is backed by a provider, `home` is not, and
 * `deep` buries its provider under plain containers. Which of them is on screen is what decides whether a refresh
 * has anywhere to land, so every store here states both the schema and the page.
 */
const space = {
  flat: {
    home: element('home', ['homeText']),
    homeText: element('homeText', [], 'client'),
    blog: element('blog', ['blogApi']),
    blogApi: element('blogApi', [], 'server'),
    deep: element('deep', ['deepBox']),
    deepBox: element('deepBox', ['deepApi']),
    deepApi: element('deepApi', [], 'server')
  },
  pages: ['home', 'blog', 'deep']
};

const Harness = ({ ssr }: { ssr?: ServerSSR }) => {
  useRscSync(ssr);

  return null;
};

const renderSync = (ssr: ServerSSR | undefined, store: StoreApi<CommonState>) =>
  render(
    <StoreProvider store={store}>
      <Harness ssr={ssr} />
    </StoreProvider>
  );

const makeStore = (rsc?: SchemaRsc, currentPageId = 'blog') =>
  createStore<CommonState>({
    schema: { ...space, rsc },
    navigation: { currentPageId }
  } as unknown as CommonState);

describe('useRscSync', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ serverData: { a: 1 } }) });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('turns RSC on only when the schema asks for it AND a server published its endpoint', () => {
    const withServer = makeStore({ enabled: true });
    renderSync({ rscPath: '/_rsc' }, withServer);

    expect(withServer.get('rsc.enabled')).toBe(true);

    // Same schema, client-only render: no endpoint was published, so the feature stays inert.
    const clientOnly = makeStore({ enabled: true });
    renderSync(undefined, clientOnly);

    expect(clientOnly.get('rsc.enabled')).toBe(false);

    const schemaOff = makeStore({ enabled: false });
    renderSync({ rscPath: '/_rsc' }, schemaOff);

    expect(schemaOff.get('rsc.enabled')).toBe(false);
  });

  it('never fetches without a published endpoint', async () => {
    renderSync(undefined, makeStore({ enabled: true }));

    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });

  it('fetches on mount when the server published an endpoint but handed over no payload', async () => {
    renderSync({ rscPath: '/_rsc' }, makeStore({ enabled: true }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect((fetchMock.mock.calls[0][0] as string).startsWith('/_rsc?location=')).toBe(true);
  });

  it('never fetches for a page of its own, even though another page in the space has a provider', async () => {
    renderSync({ rscPath: '/_rsc' }, makeStore({ enabled: true }, 'home'));

    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });

  it('never fetches when the location matched no page — there is nothing to name', async () => {
    renderSync({ rscPath: '/_rsc' }, makeStore({ enabled: true }, ''));

    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });

  it('still fetches when the page buries its provider under plain containers', async () => {
    renderSync({ rscPath: '/_rsc' }, makeStore({ enabled: true }, 'deep'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('spends nothing on navigating to a page with no provider, and pays again on one that has', async () => {
    const store = makeStore({ enabled: true });
    // Mounted with the payload already in hand, so nothing is owed for the page that was rendered.
    renderSync({ rscPath: '/_rsc', rscData: { serverData: { blogApi: 1 } } }, store);

    act(() => {
      store.set('navigation.currentPageId', 'home');
      store.set('runtime.sources.navigation', { routeParams: {}, queryParams: { to: 'home' } });
    });

    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());

    act(() => {
      store.set('navigation.currentPageId', 'deep');
      store.set('runtime.sources.navigation', { routeParams: {}, queryParams: { to: 'deep' } });
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('seeds the payload the server already resolved and asks for nothing more', async () => {
    const store = makeStore({ enabled: true });
    renderSync({ rscPath: '/_rsc', rscData: { serverData: { a: 1 } } }, store);

    expect(store.get('rsc.loaded')).toBe(true);
    expect(store.get('rsc.data')).toEqual({ a: 1 });

    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });
});

describe('refreshRsc', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const liveStore = (currentPageId = 'blog') =>
    createStore<CommonState>({
      schema: space,
      navigation: { currentPageId },
      rsc: { enabled: true, endpoint: '/_rsc', loaded: true, data: { a: 1, b: 2 } }
    } as unknown as CommonState);

  it('merges a partial refresh over the existing payload and replaces it on a full one', async () => {
    const store = liveStore();
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ serverData: { b: 22 } }) });

    await refreshRsc(store, ['b']);

    expect(store.get('rsc.data')).toEqual({ a: 1, b: 22 });
    expect(fetchMock.mock.calls[0][0] as string).toContain('ids=b');

    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ serverData: { c: 3 } }) });
    await refreshRsc(store);

    expect(store.get('rsc.data')).toEqual({ c: 3 });
  });

  it('passes extra params through — this is how a provider asks for another page window', async () => {
    const store = liveStore();
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ serverData: {} }) });

    await refreshRsc(store, ['a'], { page: '2' });

    expect(fetchMock.mock.calls[0][0] as string).toContain('page=2');
  });

  it('leaves the payload untouched when the endpoint answers with an error', async () => {
    const store = liveStore();
    fetchMock.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });

    await refreshRsc(store, ['a']);

    expect(store.get('rsc.data')).toEqual({ a: 1, b: 2 });
  });

  /**
   * Keeping what is on screen when a refresh cannot get through is right; saying nothing about it is not.
   *
   * The page goes on showing numbers from before the server went away, and looks exactly as current as it did a
   * second earlier. So the fact is published — `isStale` on every server-driven provider — and an author with
   * somewhere to put it can tell their visitor.
   */
  it('says the payload is stale when the server could not be reached, and takes it back when it can', async () => {
    const store = liveStore();
    fetchMock.mockRejectedValue(new Error('Failed to fetch'));

    await refreshRsc(store, ['a']);
    expect(store.get('rsc.stale')).toBe(true);
    expect(store.get('rsc.data'), 'the page lost the data it was showing').toEqual({ a: 1, b: 2 });

    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ serverData: { a: 9 } }) });
    await refreshRsc(store, ['a']);

    expect(store.get('rsc.stale')).toBe(false);
    expect(store.get('rsc.data')).toEqual({ a: 9, b: 2 });
  });

  it('says so for an endpoint that answered badly, too', async () => {
    const store = liveStore();
    fetchMock.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });

    await refreshRsc(store, ['a']);

    expect(store.get('rsc.stale')).toBe(true);
  });

  it('does nothing when RSC is not live for this render', async () => {
    const store = createStore<CommonState>({ rsc: { enabled: false, endpoint: '/_rsc' } });

    await refreshRsc(store);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('spends no request on a page with nothing to put the answer in, and keeps what it already had', async () => {
    const store = liveStore('home');

    await refreshRsc(store);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.get('rsc.data')).toEqual({ a: 1, b: 2 });
  });

  it('spends no request on a page it cannot name, nor on a store carrying no schema', async () => {
    await refreshRsc(liveStore(''));
    await refreshRsc(
      createStore<CommonState>({
        navigation: { currentPageId: 'blog' },
        rsc: { enabled: true, endpoint: '/_rsc' }
      } as unknown as CommonState)
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not gate out the element asking for itself on a page that does have a provider', async () => {
    const store = liveStore();
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ serverData: { blogApi: 9 } }) });

    await refreshRsc(store, ['blogApi']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(store.get('rsc.data')).toEqual({ a: 1, b: 2, blogApi: 9 });
  });
});
