import { useId } from 'react';

import useAnchoredOverlay from './useAnchoredOverlay';

import type { ReactNode } from 'react';

export type HeaderPopoverProps = {
  id: string;
  /** Its accessible name: what the panel is about. */
  label: string;
  /** The button's own title, when it says more than the label. */
  title?: string;
  trigger: ReactNode;
  triggerClassName: string;
  align?: 'start' | 'end';
  /** The panel's contents, given the way to close it. */
  children: (close: () => void) => ReactNode;
};

/**
 * A panel under a header button that says something and offers what to do about it — the draft's status. A dialog,
 * not a menu: focus moves to its first control, Escape and a press outside close it.
 */
const HeaderPopover = ({
  id,
  label,
  title,
  trigger,
  triggerClassName,
  align = 'end',
  children
}: HeaderPopoverProps) => {
  const { open, close, toggle, place, buttonRef, rootRef, panelRef } = useAnchoredOverlay(
    align,
    'a[href], button:not([disabled])'
  );
  const panelId = useId();

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        id={id}
        type="button"
        title={title ?? label}
        aria-label={title ?? label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={triggerClassName}
        onClick={toggle}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={label}
          style={place}
          className="border-ui-line bg-ui-panel text-ui-fg fixed z-[700] flex w-[min(360px,calc(100vw-16px))] flex-col rounded-xl border shadow-xl"
        >
          {children(close)}
        </div>
      )}
    </div>
  );
};

export default HeaderPopover;
