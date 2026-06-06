import { render } from '@testing-library/react';
import { createContext } from 'react';
import { describe, it, expect, vi } from 'vitest';

import StoreProvider from '@plitzi/nexus/StoreProvider';
import ElementContext from '@plitzi/sdk-shared/elements/ElementContext';

import { Link } from './Link';

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
        <ElementContext value={{ id: '', rootId: '', plitziJsxSkipHOC: true }}>
          <Link />
        </ElementContext>
      </StoreProvider>
    );

    expect(baseElement).toBeTruthy();
  });
});
