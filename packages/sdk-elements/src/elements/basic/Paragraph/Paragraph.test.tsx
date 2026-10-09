import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Paragraph } from './Paragraph';
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

describe('Paragraph Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementContext value={skipHocEntry()}>
        <Paragraph />
      </ElementContext>
    );

    expect(baseElement).toBeTruthy();
  });
});
