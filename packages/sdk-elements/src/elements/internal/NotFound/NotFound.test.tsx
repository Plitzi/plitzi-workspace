import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { NotFound } from './NotFound';
import { ElementStoreSeed, elementEntry } from '../../../testUtils/elementTestUtils';

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
      <ElementStoreSeed entries={[elementEntry('not-found')]}>
        <NotFound id="not-found" />
      </ElementStoreSeed>
    );

    expect(baseElement).toBeTruthy();
  });
});
