import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Dropdown } from './Dropdown';
import { DropdownPopup } from './DropdownPopup/DropdownPopup';
import ElementContext from '../../../Element/ElementContext';
import { elementEntry } from '../../../testUtils/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({ default: (element: unknown) => element }));

vi.mock('@plitzi/sdk-shared/hooks/usePlitzi', () => ({
  default: () => ({
    settings: { previewMode: true },
    root: { baseElementId: '' },
    utils: { getWindow: () => window }
  })
}));

/** A menu the way a space writes one: the popup first, then the button that opens it. */
const Menu = () => {
  const [open, setOpen] = useState(false);
  const entry = elementEntry('menu', {
    elementState: { openPopup: open },
    setElementState: <S extends Record<string, unknown>>(value?: S | ((prev: S) => S)) => {
      // The context's setter is generic over whatever an element keeps; this menu keeps only whether it is open.
      const next = typeof value === 'function' ? value({ openPopup: open } as unknown as S) : value;
      setOpen(Boolean(next?.openPopup));

      return true;
    }
  });

  return (
    <ElementContext value={entry}>
      <Dropdown openPopup={open}>
        <DropdownPopup>
          <button type="button">Profile</button>
          <button type="button">Sign out</button>
        </DropdownPopup>
        <button type="button" title="Account">
          <i className="fa-solid fa-user" aria-hidden="true" />
        </button>
      </Dropdown>
    </ElementContext>
  );
};

describe('Dropdown — the control that opens it', () => {
  it('says it opens a menu, and whether the menu is open', () => {
    render(<Menu />);
    const trigger = screen.getByRole('button', { name: 'Account' });

    expect(trigger.getAttribute('aria-haspopup')).toBe('true');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(trigger);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('gives the focus back to the trigger when it closes with the focus inside', () => {
    render(<Menu />);
    const trigger = screen.getByRole('button', { name: 'Account' });
    fireEvent.click(trigger);
    screen.getByRole('button', { name: 'Profile', hidden: true }).focus();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });
});
