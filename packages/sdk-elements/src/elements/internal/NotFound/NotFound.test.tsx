import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { NotFound } from './NotFound';
import ElementContext from '../../../Element/ElementContext';

import type { ElementContextValue } from '../../../Element/ElementContext';

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
      <ElementContext
        value={
          { id: '', rootId: '', plitziJsxSkipHOC: false, definition: { label: 'Not Found' } } as ElementContextValue
        }
      >
        <NotFound />
      </ElementContext>
    );

    expect(baseElement).toBeTruthy();
  });
});
