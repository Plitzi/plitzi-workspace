import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';

import { Dropdown } from './Dropdown';
import DropdownContext from './DropdownContext';
import { DropdownPopup } from './DropdownPopup/DropdownPopup';
import ElementContext from '../../../Element/ElementContext';
import { elementEntry } from '../../../testUtils/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/hooks')>()),
  usePlitzi: () => ({
    settings: { previewMode: true },
    root: { baseElementId: '' },
    utils: { getWindow: () => undefined }
  })
}));

describe('Dropdown Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementContext value={elementEntry('')}>
        <Dropdown />
      </ElementContext>
    );

    expect(baseElement).toBeTruthy();
  });

  /**
   * A menu of links closes when one is chosen. A link stops its click from bubbling (so a card around it does not fire
   * too), and the popup used to hear clicks on the way up: no link ever closed its menu. It hears them on the way down
   * now, and lets them through — an external link still has to go somewhere.
   */
  it('hears a choice inside the popup even when the choice stops its click, and lets it through', () => {
    const closed = vi.fn();
    const chosen = vi.fn();
    render(
      <ElementContext value={elementEntry('')}>
        <DropdownContext
          value={{ popupRef: createRef<HTMLDivElement>(), openPopup: true, onClick: closed, layer: null }}
        >
          <DropdownPopup>
            <a
              href="/elsewhere"
              onClick={event => {
                event.stopPropagation();
                chosen(event.defaultPrevented);
              }}
            >
              Choice
            </a>
          </DropdownPopup>
        </DropdownContext>
      </ElementContext>
    );

    fireEvent.click(screen.getByText('Choice'));

    expect(closed).toHaveBeenCalledTimes(1);
    expect(chosen).toHaveBeenCalledWith(false);
  });
});
