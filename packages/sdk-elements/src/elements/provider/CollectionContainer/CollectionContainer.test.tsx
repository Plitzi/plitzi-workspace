import { render } from '@testing-library/react';
import { createContext } from 'react';
import { describe, it, expect, vi } from 'vitest';

// import { PlitziServiceProvider } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import ElementContext from '@plitzi/sdk-shared/elements/ElementContext';
import StoreProvider from '@plitzi/sdk-store/StoreProvider';

import { CollectionContainer } from './CollectionContainer';

import type { ElementContextValue } from '@plitzi/sdk-shared';

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
        <ElementContext
          value={
            {
              id: '',
              rootId: '',
              plitziJsxSkipHOC: false,
              definition: { label: 'Collection Container' }
            } as ElementContextValue
          }
        >
          <CollectionContainer />
        </ElementContext>
      </StoreProvider>
    );

    expect(baseElement).toBeTruthy();
  });
});
