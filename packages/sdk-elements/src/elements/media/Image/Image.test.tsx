import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Image } from './Image';
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

describe('Image Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementStoreSeed entries={[{ id: '', rootId: '', plitziJsxSkipHOC: true }]}>
        <Image id="" />
      </ElementStoreSeed>
    );

    expect(baseElement).toBeTruthy();
  });
});
