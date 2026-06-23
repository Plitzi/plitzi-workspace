import { render } from '@testing-library/react';
import { createContext } from 'react';
import { describe, it, expect, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import { ApiContainer } from './ApiContainer';
import { ElementContextSeed, elementEntry } from '../../../testUtils/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    root: { baseElementId: '' },
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
        <ElementContextSeed value={elementEntry('')}>
          <ApiContainer id="" />
        </ElementContextSeed>
      </StoreProvider>
    );

    expect(baseElement).toBeTruthy();
  });
});
