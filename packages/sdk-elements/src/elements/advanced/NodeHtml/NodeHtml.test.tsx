import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { NodeHtml } from './NodeHtml';
import { ElementContextSeed } from '../../../testUtils/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    contexts: {}
  })
}));

describe('NodeHtml Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementContextSeed value={{ id: '', rootId: '', plitziJsxSkipHOC: true }}>
        <NodeHtml id="" />
      </ElementContextSeed>
    );

    expect(baseElement).toBeTruthy();
  });
});
