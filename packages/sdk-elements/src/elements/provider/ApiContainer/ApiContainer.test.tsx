import { act, render, waitFor } from '@testing-library/react';
import { createContext } from 'react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { createStore } from '@plitzi/nexus';
import { StoreProvider } from '@plitzi/nexus/react';
import { invalidateAfterWrite, invalidateQueries } from '@plitzi/sdk-shared/queries';

import { ApiContainer } from './ApiContainer';
import ElementContext from '../../../Element/ElementContext';
import { elementEntry } from '../../../testUtils/elementTestUtils';

import type { CommonState } from '@plitzi/sdk-shared';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    root: { baseElementId: '' },
    contexts: {
      InteractionsContext: createContext({
        useInteractions: () => ({}),
        interactionsManager: { interactionTrigger: () => Promise.resolve() }
      })
    }
  })
}));

describe('ApiContainer Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <StoreProvider value={{}}>
        <ElementContext value={elementEntry('')}>
          <ApiContainer />
        </ElementContext>
      </StoreProvider>
    );

    expect(baseElement).toBeTruthy();
  });
});

/**
 * A server provider is answered through the RSC payload, never through the query cache — so a write that refreshed
 * only the cache (`runServerAction`, `webHook`, the `invalidateQueries` step) left it showing what it held before.
 */
describe('ApiContainer — a server provider refreshed by a write', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    window.history.pushState({}, '', '/');
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ serverData: { orders: { records: [2] } } })
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const element = (id: string, items: string[], runtime?: 'server') => ({
    id,
    attributes: {},
    definition: { type: id, label: id, rootId: 'home', items, styleSelectors: { base: '' }, runtime }
  });

  const renderProvider = (visible = true, refreshSeconds = 0) => {
    // The slice of the common state a server provider reads: the page it is on, and the payload that answered it.
    const store = createStore<CommonState>({
      schema: { pages: ['home'], flat: { home: element('home', ['orders']), orders: element('orders', [], 'server') } },
      navigation: { currentPageId: 'home', routeParams: {}, queryParams: {} },
      rsc: { enabled: true, endpoint: '/_rsc', loaded: true, location: '/', data: { orders: { records: [1] } } }
    } as unknown as CommonState);
    const view = render(
      <StoreProvider store={store}>
        <ElementContext
          value={elementEntry('orders', {
            rootId: 'home',
            visible,
            definition: {
              rootId: 'home',
              label: 'Orders',
              type: 'apiContainer',
              styleSelectors: { base: '' },
              runtime: 'server'
            }
          })}
        >
          <ApiContainer connector="cms" resource="orders" refreshSeconds={refreshSeconds} />
        </ElementContext>
      </StoreProvider>
    );

    return { store, view };
  };

  it('asks the server again, around its caches, for the containers a write names', async () => {
    const { store, view } = renderProvider();

    await act(() => invalidateAfterWrite({ mode: 'elements', fallback: 'all', elements: 'orders' }));

    await waitFor(() => expect(store.get('rsc.data')).toEqual({ orders: { records: [2] } }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('ids=orders');
    expect(init.cache).toBe('no-cache');
    view.unmount();
  });

  it('leaves one nobody can see for when it is shown', async () => {
    const { view } = renderProvider(false);

    await act(() => invalidateQueries());

    expect(fetchMock).not.toHaveBeenCalled();
    view.unmount();
  });

  it('polls through the caches: their lifetime is the staleness a deployment allows', async () => {
    vi.useFakeTimers();
    try {
      const { view } = renderProvider(true, 1);

      await act(() => vi.advanceTimersByTimeAsync(1000));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(init.cache).toBeUndefined();
      view.unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it('is not refreshed after it unmounts', async () => {
    const { view } = renderProvider();
    view.unmount();

    await act(() => invalidateQueries());

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
