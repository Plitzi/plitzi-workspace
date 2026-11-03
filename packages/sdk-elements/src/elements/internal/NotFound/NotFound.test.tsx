import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import { NotFound } from './NotFound';
import ElementContext from '../../../Element/ElementContext';
import { elementEntry } from '../../../tests/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/hooks')>()),
  usePlitzi: () => ({
    settings: { previewMode: true }
  })
}));

describe('NotFound Tests', () => {
  it('Render Component', () => {
    // Whether the page still hydrates is read from the render settings, in the store.
    const { baseElement } = render(
      <StoreProvider value={{ render: { isHydrating: false } }}>
        <ElementContext value={elementEntry('not-found')}>
          <NotFound />
        </ElementContext>
      </StoreProvider>
    );

    expect(baseElement).toBeTruthy();
  });
});
