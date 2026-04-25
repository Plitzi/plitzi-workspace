import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import ElementContext from '@plitzi/sdk-shared/elements/ElementContext';

import { Loading } from './Loading';

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

describe('Loading Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementContext
        value={{ id: '', rootId: '', plitziJsxSkipHOC: false, definition: { label: 'Loading' } } as ElementContextValue}
      >
        <Loading />
      </ElementContext>
    );

    expect(baseElement).toBeTruthy();
  });
});
