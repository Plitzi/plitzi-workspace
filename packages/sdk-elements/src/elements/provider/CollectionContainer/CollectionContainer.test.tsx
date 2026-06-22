import { render } from '@testing-library/react';
import { createContext } from 'react';
import { describe, it, expect, vi } from 'vitest';

import StoreProvider from '@plitzi/nexus/StoreProvider';

import { CollectionContainer } from './CollectionContainer';
import { ElementStoreSeed, elementEntry } from '../../../testUtils/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    contexts: {
      NavigationContext: createContext({}),
      CollectionContext: createContext({})
    }
  })
}));

describe('CollectionContainer Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <StoreProvider value={{}}>
        <ElementStoreSeed entries={[elementEntry('collection')]}>
          <CollectionContainer id="collection" />
        </ElementStoreSeed>
      </StoreProvider>
    );

    expect(baseElement).toBeTruthy();
  });
});
