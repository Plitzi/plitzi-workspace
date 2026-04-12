import { render } from '@testing-library/react';
import { createContext } from 'react';
import { describe, it, expect, vi } from 'vitest';

// import { PlitziServiceProvider } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import { CollectionContainer } from './CollectionContainer';
import ElementContext from '../../../Element/ElementContext';

import type { ElementContextValue } from '../../../Element/ElementContext';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    contexts: {
      NavigationContext: createContext({}),
      CollectionContext: createContext({}),
      DataSourceContext: createContext({ useDataSource: () => [] })
    }
  })
}));

describe('CollectionContainer Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      // <PlitziServiceProvider>
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
      // </PlitziServiceProvider>
    );

    expect(baseElement).toBeTruthy();
  });
});
