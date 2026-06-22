import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Video } from './Video';
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

describe('Video Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementStoreSeed entries={[{ id: '', rootId: '', plitziJsxSkipHOC: true }]}>
        <Video id="" />
      </ElementStoreSeed>
    );

    expect(baseElement).toBeTruthy();
  });
});
