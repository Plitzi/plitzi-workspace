import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createStore } from '@plitzi/nexus';
import { StoreProvider } from '@plitzi/nexus/react';

import refreshRsc from './refreshRsc';
import useRscSync from './useRscSync';

import type { CommonState, SchemaRsc, ServerSSR } from '../../types';
import type { StoreApi } from '@plitzi/nexus';

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

const makeStore = (rsc?: SchemaRsc) => createStore<CommonState>({ schema: { rsc } } as CommonState);

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

  const liveStore = () =>
    createStore<CommonState>({
      rsc: { enabled: true, endpoint: '/_rsc', loaded: true, data: { a: 1, b: 2 } }
    });

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

  it('does nothing when RSC is not live for this render', async () => {
    const store = createStore<CommonState>({ rsc: { enabled: false, endpoint: '/_rsc' } });

    await refreshRsc(store);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
