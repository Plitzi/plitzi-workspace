import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Loading } from './Loading';
import { ElementContext } from '../../../Element/ElementContext';
import { elementEntry } from '../../../testUtils/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    root: { baseElementId: '' },
    contexts: {}
  })
}));

describe('Loading Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementContext value={elementEntry('loading')}>
        <Loading />
      </ElementContext>
    );

    expect(baseElement).toBeTruthy();
  });
});
