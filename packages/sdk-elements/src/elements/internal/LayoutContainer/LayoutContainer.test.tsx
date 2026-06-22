import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { LayoutContainer } from './LayoutContainer';
import { ElementStoreSeed } from '../../../testUtils/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    contexts: {}
  })
}));

describe('LayoutContainer Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementStoreSeed entries={[{ id: '', rootId: '', plitziJsxSkipHOC: true }]}>
        <LayoutContainer id="" />
      </ElementStoreSeed>
    );

    expect(baseElement).toBeTruthy();
  });
});
