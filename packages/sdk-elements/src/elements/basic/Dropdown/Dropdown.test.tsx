import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Dropdown } from './Dropdown';
import ElementContext from '../../../Element/ElementContext';
import { elementEntry } from '../../../testUtils/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitzi', () => ({
  default: () => ({
    settings: { previewMode: true },
    root: { baseElementId: '' },
    utils: { getWindow: () => undefined }
  })
}));

describe('Dropdown Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementContext value={elementEntry('')}>
        <Dropdown />
      </ElementContext>
    );

    expect(baseElement).toBeTruthy();
  });
});
