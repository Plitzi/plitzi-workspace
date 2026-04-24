import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import ElementContext from '@plitzi/sdk-shared/elements/ElementContext';

import { Text } from './Text';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    contexts: {}
  })
}));

describe('Text Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementContext value={{ id: '', rootId: '', plitziJsxSkipHOC: true }}>
        <Text />
      </ElementContext>
    );

    expect(baseElement).toBeTruthy();
  });
});
