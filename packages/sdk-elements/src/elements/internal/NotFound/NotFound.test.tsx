import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { NotFound } from './NotFound';
import ElementContext from '../../../Element/ElementContext';
import { elementEntry } from '../../../tests/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/hooks')>()),
  usePlitzi: () => ({
    settings: { previewMode: true, isHydrating: false }
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
