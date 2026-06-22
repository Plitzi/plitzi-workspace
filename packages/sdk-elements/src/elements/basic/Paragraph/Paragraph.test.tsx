import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Paragraph } from './Paragraph';
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

describe('Paragraph Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementStoreSeed entries={[{ id: '', rootId: '', plitziJsxSkipHOC: true }]}>
        <Paragraph id="" />
      </ElementStoreSeed>
    );

    expect(baseElement).toBeTruthy();
  });
});
