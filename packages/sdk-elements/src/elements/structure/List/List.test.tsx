import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { List } from './List';
import { ElementContext } from '../../../Element/ElementContext';
import { skipHocEntry } from '../../../testUtils/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    contexts: {}
  })
}));

describe('List Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementContext value={skipHocEntry()}>
        <List />
      </ElementContext>
    );

    expect(baseElement).toBeTruthy();
  });
});
