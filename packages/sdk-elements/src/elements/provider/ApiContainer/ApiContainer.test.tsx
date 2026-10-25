import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { createStore } from '@plitzi/nexus';
import { StoreProvider, createStoreHook } from '@plitzi/nexus/react';
import { invalidateAfterWrite, invalidateQueries } from '@plitzi/sdk-shared/queries';
import { RSC_FAILURE } from '@plitzi/sdk-shared/schema';

import { ApiContainer } from './ApiContainer';
import ElementContext from '../../../Element/ElementContext';
import { elementEntry } from '../../../tests/elementTestUtils';

import type { CommonState } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/hooks')>()),
  usePlitzi: () => ({
    settings: { previewMode: true },
    root: { baseElementId: '' }
  })
}));

vi.mock('@plitzi/sdk-interactions', async importOriginal => {
  const { createContext } = await import('react');

  return {
    ...(await importOriginal<typeof import('@plitzi/sdk-interactions')>()),
    InteractionsContext: createContext({
      useInteractions: () => ({}),
      interactionsManager: { interactionTrigger: () => Promise.resolve() }
    })
  };
});

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

  const renderProvider = (visible = true, refreshSeconds = 0, children?: ReactNode) => {
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
          <ApiContainer connector="cms" resource="orders" refreshSeconds={refreshSeconds}>
            {children}
          </ApiContainer>
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

  // A provider whose action had no render trigger said only "could not be reached"; the page server, while
  // developing, says why where the provider reads it.
  it('says why the page server could not resolve it, when it said', () => {
    const { useStore } = createStoreHook<{
      runtime?: { sources?: { apiContainer_orders?: { errorMessage?: string } } };
    }>();
    const Said = () => {
      const [message = ''] = useStore('runtime.sources.apiContainer_orders.errorMessage');

      return <span>{message}</span>;
    };
    const { store, view } = renderProvider(true, 0, <Said />);

    act(() => {
      store.set('rsc.data', { orders: { [RSC_FAILURE]: 'Action "orders" has no "render" trigger' } });
    });

    expect(view.queryByText('Action "orders" has no "render" trigger')).not.toBeNull();
    view.unmount();
  });

  it('keeps its children on the page being left while the next page’s payload is fetched', () => {
    const { store, view } = renderProvider(true, 0, <span>The orders</span>);
    expect(view.queryByText('The orders')).not.toBeNull();

    // The destination's payload lands before the route changes: this page is still the one on screen.
    act(() => {
      store.set('rsc.location', '/fighters/alondrissa');
      store.set('rsc.data', { fighter: { name: 'Alondrissa' } });
    });

    expect(view.queryByText('The orders')).not.toBeNull();
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

  // A guest's page left out a provider waiting on `auth.isAuthenticated`; it said "could not be reached", and once the
  // visitor signed in nobody asked for it. Its `when` was read against the route and query params alone.
  it('waits on its `when`, read from the sources it names, and asks once it holds', async () => {
    const { useStore } = createStoreHook<{
      runtime?: { sources?: { apiContainer_orders?: { hasError?: boolean } } };
    }>();
    const Said = () => {
      const [hasError = false] = useStore('runtime.sources.apiContainer_orders.hasError');

      return <span>{hasError ? 'failed' : 'waiting'}</span>;
    };
    const store = createStore<CommonState>({
      schema: { pages: ['home'], flat: { home: element('home', ['orders']), orders: element('orders', [], 'server') } },
      navigation: { currentPageId: 'home', routeParams: {}, queryParams: {} },
      rsc: { enabled: true, endpoint: '/_rsc', loaded: true, location: '/', data: {} },
      runtime: { sources: { auth: { isAuthenticated: false } } }
    } as unknown as CommonState);
    const view = render(
      <StoreProvider store={store}>
        <ElementContext
          value={elementEntry('orders', {
            rootId: 'home',
            definition: {
              rootId: 'home',
              label: 'Orders',
              type: 'apiContainer',
              styleSelectors: { base: '' },
              runtime: 'server'
            }
          })}
        >
          <ApiContainer
            connector="cms"
            resource="orders"
            when={{ combinator: 'and', rules: [{ field: 'auth.isAuthenticated', operator: '=', value: true }] }}
          >
            <Said />
          </ApiContainer>
        </ElementContext>
      </StoreProvider>
    );

    expect(view.queryByText('waiting')).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    act(() => {
      store.set('runtime.sources.auth.isAuthenticated', true);
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect((fetchMock.mock.calls[0] as [string])[0]).toContain('ids=orders');
    view.unmount();
  });

  it('is not refreshed after it unmounts', async () => {
    const { view } = renderProvider();
    view.unmount();

    await act(() => invalidateQueries());

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
