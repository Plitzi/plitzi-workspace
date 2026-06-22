import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Button } from './Button';
import { ElementStoreSeed, elementEntry } from '../../../testUtils/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    root: { baseElementId: '' },
    contexts: {}
  })
}));

describe('Button Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementStoreSeed entries={[elementEntry('btn', { definition: { label: 'Button' } as never })]}>
        <Button id="btn" />
      </ElementStoreSeed>
    );

    expect(baseElement).toBeTruthy();
  });
});
