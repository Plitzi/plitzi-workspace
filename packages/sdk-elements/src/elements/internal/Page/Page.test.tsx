import { HelmetProvider } from '@dr.pogodin/react-helmet';
import { render, waitFor } from '@testing-library/react';
import { createContext } from 'react';
import { describe, it, expect, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import { Page } from './Page';
import ElementContext from '../../../Element/ElementContext';
import { skipHocEntry } from '../../../testUtils/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    contexts: {
      InteractionsContext: createContext({
        useInteractions: () => ({}),
        interactionsManager: { interactionTrigger: () => {} }
      })
    }
  })
}));

vi.mock('../LayoutContainer', async () => {
  const { useLayoutBody } =
    await vi.importActual<typeof import('../../../Element/LayoutBody')>('../../../Element/LayoutBody');

  return {
    default: function LayoutContainerMock({
      internalProps
    }: {
      internalProps: { id: string; plitziElementLayout: { slots: string[] } };
    }) {
      const body = useLayoutBody(internalProps.plitziElementLayout.slots[0]);

      return (
        <div data-layout={internalProps.id} data-slot={internalProps.plitziElementLayout.slots[0]}>
          {body}
        </div>
      );
    }
  };
});

const navigation = { routeParams: {}, queryParams: {} };

const shell = (id: string, attributes: Record<string, unknown> = {}) => ({
  id,
  attributes,
  definition: { rootId: id, label: id, type: 'layoutContainer', items: [], styleSelectors: { base: '' } }
});

describe('Page Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <StoreProvider value={{ navigation }}>
        <ElementContext value={skipHocEntry()}>
          <Page />
        </ElementContext>
      </StoreProvider>
    );

    expect(baseElement).toBeTruthy();
  });

  /**
   * The body sits in the innermost shell and that shell in the one around it — built from the outside in, so the
   * outer shell is the same element for a page that sits in it directly and for one nested a level deeper.
   */
  it('renders the body inside every shell of the chain, the outermost at the top', () => {
    const schema = {
      flat: {
        platform: shell('platform'),
        analytics: shell('analytics', { layout: 'platform', layoutContainer: 'platform-body' })
      }
    };
    const { container } = render(
      <StoreProvider value={{ navigation, schema }}>
        <ElementContext value={skipHocEntry()}>
          <Page layout="analytics" layoutContainer="analytics-body">
            <p>body</p>
          </Page>
        </ElementContext>
      </StoreProvider>
    );

    const outer = container.querySelector('[data-layout]');
    const inner = outer?.querySelector('[data-layout]');

    expect(outer?.getAttribute('data-layout')).toBe('platform');
    expect(outer?.getAttribute('data-slot')).toBe('platform-body');
    expect(inner?.getAttribute('data-layout')).toBe('analytics');
    expect(inner?.getAttribute('data-slot')).toBe('analytics-body');
    expect(inner?.querySelector('p')?.textContent).toBe('body');
  });

  it('renders the body as it is without a layout', () => {
    const { container } = render(
      <StoreProvider value={{ navigation, schema: { flat: {} } }}>
        <ElementContext value={skipHocEntry()}>
          <Page>
            <p>body</p>
          </Page>
        </ElementContext>
      </StoreProvider>
    );

    expect(container.querySelector('[data-layout]')).toBeNull();
    expect(container.querySelector('p')?.textContent).toBe('body');
  });

  it('writes its SEO into a head that is its own', async () => {
    document.title = 'Host';
    render(
      <HelmetProvider>
        <StoreProvider value={{ navigation }}>
          <ElementContext value={skipHocEntry()}>
            <Page seoEnabled seoPageTitle="Tremor" seoPageDescription="Earthquakes" />
          </ElementContext>
        </StoreProvider>
      </HelmetProvider>
    );

    await waitFor(() => expect(document.title).toBe('Tremor'));
  });

  it('says the record a detail page shows: a template read against its server providers and the address', async () => {
    document.title = 'Host';
    const node = (id: string, type: string, items: string[] = [], runtime?: 'server') => ({
      id,
      attributes: {},
      definition: { type, label: id, rootId: 'capsule-page', items, styleSelectors: { base: '' }, runtime }
    });
    const flat = {
      'capsule-page': node('capsule-page', 'page', ['capsule']),
      capsule: node('capsule', 'apiContainer', [], 'server')
    };
    render(
      <HelmetProvider>
        <StoreProvider
          value={{
            navigation: { routeParams: { slug: 'montana-37' }, queryParams: {} },
            schema: { flat },
            rsc: { data: { capsule: { title: 'Montaña nº 37' } } }
          }}
        >
          <ElementContext value={skipHocEntry('capsule-page')}>
            <Page
              seoEnabled
              seoPageTitle="{{ apiContainer_capsule.title }} — Shop"
              seoPageDescription="Capsule {{ navigation.routeParams.slug }}"
            />
          </ElementContext>
        </StoreProvider>
      </HelmetProvider>
    );

    await waitFor(() => expect(document.title).toBe('Montaña nº 37 — Shop'));
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Capsule montana-37');
  });

  /**
   * The builder's canvas: the page is drawn in a frame, and the head its code would write is the editor's. A second
   * head manager there rewrote the host page's tags — the builder's own stylesheet with them — on every preview.
   */
  it('leaves a head that is not its own alone, with no head manager needed at all', async () => {
    document.title = 'Builder';
    render(
      <StoreProvider value={{ navigation, render: { ownsHead: false } }}>
        <ElementContext value={skipHocEntry()}>
          <Page seoEnabled seoPageTitle="Tremor" seoPageDescription="Earthquakes" />
        </ElementContext>
      </StoreProvider>
    );

    await new Promise(resolve => requestAnimationFrame(resolve));
    expect(document.title).toBe('Builder');
    expect(document.head.querySelector('meta[name="description"]')).toBeNull();
  });
});
