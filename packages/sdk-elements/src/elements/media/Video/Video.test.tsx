import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Video } from './Video';
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

describe('Video Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementContext value={skipHocEntry()}>
        <Video />
      </ElementContext>
    );

    expect(baseElement).toBeTruthy();
  });
});
