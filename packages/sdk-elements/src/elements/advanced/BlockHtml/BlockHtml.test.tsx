import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { BlockHtml } from './BlockHtml';
import ElementContext from '../../../Element/ElementContext';
import { skipHocEntry } from '../../../testUtils/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitzi', () => ({
  default: () => ({
    settings: { previewMode: true }
  })
}));

describe('BlockHtml Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementContext value={skipHocEntry()}>
        <BlockHtml />
      </ElementContext>
    );

    expect(baseElement).toBeTruthy();
  });
});
