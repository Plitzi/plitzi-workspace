import { fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FocusGroup } from './FocusGroup';
import ElementContext from '../../../Element/ElementContext';
import { skipHocEntry } from '../../../tests/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/hooks')>()),
  usePlitzi: () => ({
    settings: { previewMode: true }
  })
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a focus group', () => {
  it('moves the focus between its controls with the arrow keys, from its field down into them', () => {
    // jsdom lays nothing out; in a browser each of these has a box.
    vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
    const { getByText, getByRole } = render(
      <ElementContext value={skipHocEntry()}>
        <FocusGroup label="Search results">
          <input aria-label="Query" />
          <button>First</button>
          <button>Second</button>
        </FocusGroup>
      </ElementContext>
    );

    expect(getByRole('group', { name: 'Search results' })).toBeTruthy();

    const field = getByRole('textbox', { name: 'Query' });
    field.focus();
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(getByText('First'));

    fireEvent.keyDown(getByText('First'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(getByText('Second'));

    fireEvent.keyDown(getByText('Second'), { key: 'ArrowDown', shiftKey: true });
    expect(document.activeElement).toBe(getByText('Second'));
  });
});
