import { render } from '@testing-library/react';
import { createContext } from 'react';
import { describe, it, expect, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import { Link } from './Link';
import { ElementStoreSeed } from '../../../testUtils/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    contexts: {
      NavigationContext: createContext({ navigate: () => {}, routeParams: {}, queryParams: {}, currentPageId: '' })
    }
  })
}));

describe('Link Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <StoreProvider>
        <ElementStoreSeed entries={[{ id: '', rootId: '', plitziJsxSkipHOC: true }]}>
          <Link id="" />
        </ElementStoreSeed>
      </StoreProvider>
    );

    expect(baseElement).toBeTruthy();
  });
});
