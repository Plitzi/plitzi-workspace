import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Dropdown } from './Dropdown';
import ElementContext from '../../../Element/ElementContext';

import type { ElementContextValue } from '../../../Element/ElementContext';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    utils: { getWindow: () => undefined },
    contexts: {}
  })
}));

describe('Dropdown Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementContext
        value={
          {
            id: '',
            rootId: '',
            plitziJsxSkipHOC: false,
            definition: { styleSelectors: { base: '' } },
            setElementState: () => {}
          } as ElementContextValue
        }
      >
        <Dropdown />
      </ElementContext>
    );

    expect(baseElement).toBeTruthy();
  });
});
