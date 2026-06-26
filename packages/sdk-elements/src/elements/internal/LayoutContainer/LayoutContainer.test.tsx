import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { LayoutContainer } from './LayoutContainer';
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

describe('LayoutContainer Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementContext value={skipHocEntry()}>
        <LayoutContainer />
      </ElementContext>
    );

    expect(baseElement).toBeTruthy();
  });
});
