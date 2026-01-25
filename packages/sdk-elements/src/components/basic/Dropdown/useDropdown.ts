import { useDidUpdateEffect } from '@plitzi/plitzi-ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Dispatch, RefObject, SetStateAction } from 'react';

export type FloatingPosition = { top: number; left: number };

export type UseDropdownProps = {
  ref?: RefObject<HTMLDivElement | null>;
  popupRef?: RefObject<HTMLDivElement | null>;
  open?: boolean;
  disabled?: boolean;
  loading?: boolean;
  closeOnClickPopup?: boolean;
  placement?: 'left' | 'right' | 'top' | 'bottom';
  myWindow?: Window | null;
  offsetX?: number;
  offsetY?: number;
  onChange?: (open: boolean, isControlled: boolean) => void;
};

export type UseDropdownReturn = [
  boolean,
  Dispatch<SetStateAction<boolean>>,
  (e: React.MouseEvent) => void,
  (e: React.MouseEvent) => void,
  DOMRect | undefined,
  FloatingPosition | undefined
];

const useDropdown = ({
  ref,
  popupRef,
  open: openProp,
  placement = 'bottom',
  disabled = false,
  loading = false,
  closeOnClickPopup = true,
  offsetX = 0,
  offsetY = 0,
  myWindow,
  onChange
}: UseDropdownProps): UseDropdownReturn => {
  const [open, setOpen] = useState<boolean>(openProp ?? false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | undefined>(() => ref?.current?.getBoundingClientRect());
  const windowInstance = useMemo(() => {
    if (myWindow) {
      return myWindow;
    }

    if (typeof window !== 'undefined') {
      return window;
    }

    return null;
  }, [myWindow]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (disabled || loading) {
        return;
      }

      e.stopPropagation();
      e.preventDefault();
      if (openProp !== undefined) {
        onChange?.(!open, false);

        return;
      }

      onChange?.(!open, true);
      setOpen(state => !state);
    },
    [disabled, loading, onChange, open, openProp]
  );

  const handleClickPopup = useCallback(
    (e: React.MouseEvent) => {
      if (disabled || loading || !closeOnClickPopup) {
        return;
      }

      e.stopPropagation();
      e.preventDefault();
      if (openProp !== undefined) {
        onChange?.(!open, false);

        return;
      }

      onChange?.(!open, true);
      setOpen(state => !state);
    },
    [closeOnClickPopup, disabled, loading, onChange, open, openProp]
  );

  useEffect(() => {
    const el = ref?.current;
    if (!el || typeof window === 'undefined') {
      return;
    }

    const updateRect = () => setTriggerRect(ref.current?.getBoundingClientRect());
    let resizeObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateRect);
      resizeObserver.observe(el);
    }

    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [open, ref]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onChange?.(!open, openProp !== undefined);
        setOpen(state => !state);
      }
    },
    [onChange, open, openProp]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, handleKeyDown]);

  const calculatePosition = useCallback(
    (popupRect: DOMRect): FloatingPosition | undefined => {
      if (!triggerRect || !windowInstance) {
        return;
      }

      const vw = windowInstance.innerWidth;
      const vh = windowInstance.innerHeight;
      let top = 0;
      let left = 0;

      switch (placement) {
        case 'top':
          top = triggerRect.top - popupRect.height;
          left = triggerRect.left;
          break;
        case 'bottom':
          top = triggerRect.bottom;
          left = triggerRect.left;
          break;
        case 'left':
          top = triggerRect.top;
          left = triggerRect.left - popupRect.width;
          break;
        case 'right':
          top = triggerRect.top;
          left = triggerRect.right;
          break;
        default:
          top = triggerRect.bottom;
          left = triggerRect.left;
      }

      if (placement === 'bottom') {
        top += offsetY;
        left += offsetX;
      } else if (placement === 'top') {
        top -= offsetY;
        left += offsetX;
      } else if (placement === 'left') {
        top += offsetY;
        left -= offsetX;
      } else if ((placement as string) === 'right') {
        top += offsetY;
        left += offsetX;
      }

      // Clamp to viewport (edge handling)
      if (placement === 'bottom' || placement === 'top') {
        // Horizontal clamping with edge-aware alignment
        if (left + popupRect.width > vw) {
          left = triggerRect.right - popupRect.width;
        } else if (left < 0) {
          left = triggerRect.left;
        }

        // Vertical clamping within viewport
        top = Math.max(0, Math.min(vh - popupRect.height, top));
      } else if (placement === 'left' || (placement as string) === 'right') {
        // Vertical clamping with edge-aware alignment
        if (top + popupRect.height > vh) {
          top = triggerRect.bottom - popupRect.height;
        } else if (top < 0) {
          top = triggerRect.top;
        }

        // Horizontal clamping within viewport
        left = Math.max(0, Math.min(vw - popupRect.width, left));
      } else {
        // For other placements, clamp both horizontally and vertically within viewport
        top = Math.max(0, Math.min(vh - popupRect.height, top));
        left = Math.max(0, Math.min(vw - popupRect.width, left));
      }

      return { top, left };
    },
    [triggerRect, windowInstance, placement, offsetY, offsetX]
  );

  useDidUpdateEffect(() => {
    setOpen(openProp ?? false);
  }, [openProp]);

  const floatingPosition = useMemo<FloatingPosition | undefined>(() => {
    if (!open || !ref?.current) {
      return;
    }

    if (!popupRef?.current) {
      return;
    }

    const popupRect = popupRef.current.getBoundingClientRect();

    return calculatePosition(popupRect);
  }, [open, ref, popupRef, calculatePosition]);

  return [open, setOpen, handleClick, handleClickPopup, triggerRect, floatingPosition];
};

export default useDropdown;
