import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { BlockHtml } from './BlockHtml';
import { ElementStoreSeed } from '../../../testUtils/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    contexts: {}
  })
}));

describe('BlockHtml Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementStoreSeed entries={[{ id: '', rootId: '', plitziJsxSkipHOC: true }]}>
        <BlockHtml id="" />
      </ElementStoreSeed>
    );

    expect(baseElement).toBeTruthy();
  });
});
