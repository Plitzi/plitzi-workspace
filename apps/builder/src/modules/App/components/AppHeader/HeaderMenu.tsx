import clsx from 'clsx';
import { useCallback, useId } from 'react';

import useAnchoredOverlay from './useAnchoredOverlay';

import type { KeyboardEvent, ReactNode } from 'react';

export type HeaderMenuItem = {
  id: string;
  label: string;
  /** A second line, quieter: what the item does, or to what. */
  detail?: string;
  icon?: string;
  /** A choice among others in its section (the theme): marked when it is the one in force. */
  checked?: boolean;
  onSelect: () => void;
};

export type HeaderMenuSection = { label?: string; items: readonly HeaderMenuItem[] };

export type HeaderMenuProps = {
  id: string;
  /** Its accessible name and title: what the menu is for. */
  label: string;
  /** What the button shows. */
  trigger: ReactNode;
  triggerClassName: string;
  /** Which edge of the button the menu lines up with: its start under a button on the left, its end on the right. */
  align?: 'start' | 'end';
  sections: readonly HeaderMenuSection[];
};

/**
 * A menu under a header button — the logo's: the way back to the spaces, the export, the theme. Opened, focus moves
 * into it; arrows move between its items, Escape and a press outside close it, and choosing an item closes it. It is
 * placed on the window, not inside the header: the header's left side scrolls when it is short of room, and would clip it.
 */
const HeaderMenu = ({ id, label, trigger, triggerClassName, align = 'start', sections }: HeaderMenuProps) => {
  const {
    open,
    close,
    toggle,
    place,
    buttonRef,
    rootRef,
    panelRef: menuRef
  } = useAnchoredOverlay(align, '[role^="menuitem"]');
  const menuId = useId();

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) {
      return;
    }

    event.preventDefault();
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]') ?? [])];
    const at = items.findIndex(item => item === document.activeElement);
    items[(at + step + items.length) % items.length]?.focus();
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        id={id}
        type="button"
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={triggerClassName}
        onClick={toggle}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          style={place}
          className="border-ui-line bg-ui-panel fixed z-[700] flex min-w-56 flex-col gap-1 rounded-lg border p-1 shadow-lg"
          onKeyDown={handleKeyDown}
        >
          {sections.map((section, index) => (
            <div
              key={section.label ?? index}
              role="group"
              aria-label={section.label}
              className={clsx(index > 0 && 'border-ui-line border-t pt-1')}
            >
              {section.label && (
                <span className="text-ui-fg-subtle block px-2 py-1 text-[10px] font-bold tracking-wider uppercase">
                  {section.label}
                </span>
              )}
              {section.items.map(item => (
                <button
                  key={item.id}
                  id={item.id}
                  type="button"
                  role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
                  aria-checked={item.checked}
                  className="text-ui-fg hover:bg-ui-hover focus-visible:bg-ui-hover flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none"
                  onClick={() => {
                    close();
                    item.onSelect();
                  }}
                >
                  <i className={clsx(item.icon ?? 'fa-solid', 'text-ui-fg-subtle w-4 shrink-0 text-center text-xs')} />
                  <span className="flex min-w-0 grow flex-col">
                    <span className="truncate">{item.label}</span>
                    {item.detail && <span className="text-ui-fg-subtle truncate text-xs">{item.detail}</span>}
                  </span>
                  {item.checked && <i className="fa-solid fa-check text-primary-500 text-xs" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HeaderMenu;
