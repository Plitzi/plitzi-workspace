import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { NotFound } from './NotFound';
import { ElementContextSeed, elementEntry } from '../../../testUtils/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    contexts: {}
  })
}));

describe('NotFound Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementContextSeed value={elementEntry('not-found')}>
        <NotFound id="not-found" />
      </ElementContextSeed>
    );

    expect(baseElement).toBeTruthy();
  });
});
