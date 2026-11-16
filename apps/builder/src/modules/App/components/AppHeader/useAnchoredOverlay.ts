import useOverlayEscape from '@plitzi/plitzi-ui/hooks/useOverlayEscape';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { CSSProperties } from 'react';

/**
 * A panel opened under a header button — a menu, a popover: placed on the window under the button (the header's left
 * side scrolls when short of room, and would clip it), its first control focused when it opens, closed by Escape, by a
 * press outside it and by `close`.
 */
const useAnchoredOverlay = (align: 'start' | 'end', focusSelector: string) => {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useOverlayEscape(open, close);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    panelRef.current?.querySelector<HTMLElement>(focusSelector)?.focus();
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);

    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [focusSelector, open]);

  const toggle = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setPlace(
        align === 'start'
          ? { top: rect.bottom + 6, left: rect.left }
          : { top: rect.bottom + 6, right: window.innerWidth - rect.right }
      );
    }

    setOpen(value => !value);
  }, [align]);

  return { open, close, toggle, place, buttonRef, rootRef, panelRef };
};

export default useAnchoredOverlay;
