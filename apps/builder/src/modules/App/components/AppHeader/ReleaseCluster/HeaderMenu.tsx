import useOverlayEscape from '@plitzi/plitzi-ui/hooks/useOverlayEscape';
import clsx from 'clsx';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import type { KeyboardEvent } from 'react';

export type HeaderMenuItem = {
  id: string;
  label: string;
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
  icon: string;
  sections: readonly HeaderMenuSection[];
};

/**
 * A menu under a header button: what the header keeps a step back — the export, the theme. Opened, focus moves into it;
 * arrows move between its items, Escape and a press outside close it, and choosing an item closes it.
 */
const HeaderMenu = ({ id, label, icon, sections }: HeaderMenuProps) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const close = useCallback(() => setOpen(false), []);

  useOverlayEscape(open, close);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    menuRef.current?.querySelector<HTMLButtonElement>('[role^="menuitem"]')?.focus();
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);

    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

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
        id={id}
        type="button"
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="text-ui-fg-subtle hover:bg-ui-hover hover:text-ui-fg flex h-7 w-7 cursor-pointer items-center justify-center rounded transition-colors"
        onClick={() => setOpen(value => !value)}
      >
        <i className={clsx(icon, 'text-sm')} />
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          className="border-ui-line bg-ui-panel absolute top-full right-0 z-50 mt-1 flex min-w-52 flex-col gap-1 rounded-lg border p-1 shadow-lg"
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
                    setOpen(false);
                    item.onSelect();
                  }}
                >
                  <i className={clsx(item.icon ?? 'fa-solid', 'text-ui-fg-subtle w-4 text-center text-xs')} />
                  <span className="grow">{item.label}</span>
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
