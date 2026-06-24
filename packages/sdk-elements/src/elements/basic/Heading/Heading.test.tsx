import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Heading } from './Heading';
import { ElementContext } from '../../../Element/ElementContext';
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

describe('Heading Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementContext value={skipHocEntry()}>
        <Heading />
      </ElementContext>
    );

    expect(baseElement).toBeTruthy();
  });
});
