import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { TabContainer } from './TabContainer';
import ElementContext from '../../../Element/ElementContext';
import { skipHocEntry } from '../../../testUtils/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/hooks')>()),
  usePlitzi: () => ({
    settings: { previewMode: true }
  })
}));

describe('TabContainer Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementContext value={skipHocEntry()}>
        <TabContainer />
      </ElementContext>
    );

    expect(baseElement).toBeTruthy();
  });
});
