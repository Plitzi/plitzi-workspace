import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { BlockJsx } from './BlockJsx';
import ElementContext from '../../../Element/ElementContext';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    contexts: {}
  })
}));

describe('BlockJsx Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementContext value={{ id: '', rootId: '', plitziJsxSkipHOC: true }}>
        <BlockJsx />
      </ElementContext>
    );

    expect(baseElement).toBeTruthy();
  });
});
