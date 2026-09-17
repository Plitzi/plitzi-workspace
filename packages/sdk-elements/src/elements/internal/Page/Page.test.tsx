import { render } from '@testing-library/react';
import { createContext } from 'react';
import { describe, it, expect, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import { Page } from './Page';
import ElementContext from '../../../Element/ElementContext';
import { skipHocEntry } from '../../../testUtils/elementTestUtils';

import type { ReactNode } from 'react';

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

vi.mock('../LayoutContainer', () => ({
  default: ({
    internalProps
  }: {
    internalProps: { id: string; plitziElementLayout: { containerId: string; bodyChildren: ReactNode } };
  }) => (
    <div data-layout={internalProps.id} data-slot={internalProps.plitziElementLayout.containerId}>
      {internalProps.plitziElementLayout.bodyChildren}
    </div>
  )
}));

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
});
