import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { NotFound } from './NotFound';
import { ElementContext } from '../../../Element/ElementContext';
import { elementEntry } from '../../../testUtils/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true, isHydrating: false },
    contexts: {}
  })
}));

describe('NotFound Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementContext value={elementEntry('not-found')}>
        <NotFound />
      </ElementContext>
    );

    expect(baseElement).toBeTruthy();
  });
});
