import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import ElementContext from '@plitzi/sdk-shared/elements/ElementContext';

import { Button } from './Button';

import type { ElementContextValue } from '@plitzi/sdk-shared';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    contexts: {}
  })
}));

describe('Button Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementContext
        value={{ id: '', rootId: '', plitziJsxSkipHOC: false, definition: { label: 'Button' } } as ElementContextValue}
      >
        <Button />
      </ElementContext>
    );

    expect(baseElement).toBeTruthy();
  });
});
