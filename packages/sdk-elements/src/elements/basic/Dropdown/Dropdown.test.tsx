import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Dropdown } from './Dropdown';
import { ElementStoreSeed, elementEntry } from '../../../testUtils/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    root: { baseElementId: '' },
    utils: { getWindow: () => undefined },
    contexts: {}
  })
}));

describe('Dropdown Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementStoreSeed entries={[elementEntry('')]}>
        <Dropdown id="" />
      </ElementStoreSeed>
    );

    expect(baseElement).toBeTruthy();
  });
});
