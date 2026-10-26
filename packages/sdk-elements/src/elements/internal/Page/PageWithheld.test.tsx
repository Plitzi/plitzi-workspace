import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import PageWithheld from './PageWithheld';

import type { Element } from '@plitzi/sdk-shared';

vi.mock('@plitzi/sdk-shared/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/hooks')>()),
  usePlitzi: () => ({ settings: { previewMode: true } })
}));

// What the page's items are drawn by is the same for every element; what is tested here is which page is drawn.
vi.mock('../../../Element/hooks/useInternalItems', () => ({
  default: ({ id, definition }: { id: string; definition: Element['definition'] }) => (
    <div data-page={id}>{definition.items?.join(',')}</div>
  )
}));

const page = (id: string, items: string[], attributes: Record<string, unknown> = {}): Element => ({
  id,
  attributes,
  definition: { rootId: id, label: id, type: 'page', items, styleSelectors: { base: '' } }
});

const space = (withheldPage?: string) => ({
  schema: {
    pages: ['staff', 'noAccess'],
    settings: withheldPage === undefined ? {} : { withheldPage },
    flat: {
      staff: page('staff', [], { access: { permissions: ['adminManage'] }, withheld: 'forbidden' }),
      noAccess: page('noAccess', ['ownWords', 'askLink'])
    }
  }
});

describe('PageWithheld', () => {
  it('draws the page the space names for it', () => {
    const { container } = render(
      <StoreProvider value={space('noAccess')}>
        <PageWithheld reason="forbidden" />
      </StoreProvider>
    );

    expect(container.querySelector('[data-page="noAccess"]')?.textContent).toBe('ownWords,askLink');
    expect(container.querySelector('[data-withheld]')).toBeNull();
  });

  it("says why in the platform's words when the space names none, or one withheld itself", () => {
    for (const named of [undefined, 'staff']) {
      const { container, unmount } = render(
        <StoreProvider value={space(named)}>
          <PageWithheld reason="unauthenticated" />
        </StoreProvider>
      );

      expect(container.querySelector('[data-withheld="unauthenticated"]')?.textContent).toContain('Sign in');
      unmount();
    }
  });
});
