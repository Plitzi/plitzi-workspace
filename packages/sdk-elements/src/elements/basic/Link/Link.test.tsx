import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import { Link } from './Link';
import ElementContext from '../../../Element/ElementContext';
import { skipHocEntry } from '../../../testUtils/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    contexts: {}
  })
}));

const navigation = {
  routeParams: {},
  queryParams: {},
  hostname: 'example.test',
  currentPageId: 'page-1'
};

describe('Link Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <StoreProvider value={{ navigation }}>
        <ElementContext value={skipHocEntry()}>
          <Link />
        </ElementContext>
      </StoreProvider>
    );

    expect(baseElement).toBeTruthy();
  });
});
