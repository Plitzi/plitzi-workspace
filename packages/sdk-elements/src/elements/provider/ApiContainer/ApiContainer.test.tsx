import { render } from '@testing-library/react';
import { createContext } from 'react';
import { describe, it, expect, vi } from 'vitest';

import DataSourceContext from '@plitzi/sdk-shared/dataSource/DataSourceContext';

import { ApiContainer } from './ApiContainer';
import ElementContext from '../../../Element/ElementContext';

import type { ElementContextValue } from '../../../Element/ElementContext';
import type { DataSourceContextValue } from '@plitzi/sdk-shared';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    contexts: {
      InteractionsContext: createContext({ useInteractions: () => ({}) }),
      NavigationContext: createContext({}),
      DataSourceContext
    }
  })
}));

describe('ApiContainer Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <DataSourceContext
        value={
          { useDataSource: () => [createContext({})], getSources: () => ({}) } as unknown as DataSourceContextValue
        }
      >
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
      </DataSourceContext>
    );

    expect(baseElement).toBeTruthy();
  });
});
