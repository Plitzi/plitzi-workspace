import { render } from '@testing-library/react';
import { createContext } from 'react';
import { describe, it, expect, vi } from 'vitest';

import ElementContext from '@plitzi/sdk-shared/elements/ElementContext';
import StoreProvider from '@plitzi/sdk-store/StoreProvider';

import { ApiContainer } from './ApiContainer';

import type { ElementContextValue } from '@plitzi/sdk-shared';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    contexts: {
      InteractionsContext: createContext({ useInteractions: () => ({}) }),
      NavigationContext: createContext({})
    }
  })
}));

describe('ApiContainer Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <StoreProvider value={{}}>
        <ElementContext
          value={
            {
              id: '',
              rootId: '',
              plitziJsxSkipHOC: true,
              definition: { label: 'Api Container', styleSelectors: { base: '' } },
              elementState: {}
            } as ElementContextValue
          }
        >
          <ApiContainer />
        </ElementContext>
      </StoreProvider>
    );

    expect(baseElement).toBeTruthy();
  });
});
