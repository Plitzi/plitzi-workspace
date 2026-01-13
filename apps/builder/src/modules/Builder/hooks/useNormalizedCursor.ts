import { useEffect, useRef, useCallback } from 'react';

const useNormalizedCursor = <T extends HTMLElement | null>(
  containerRef: React.RefObject<T>,
  { enabled = true, onMove }: { enabled?: boolean; onMove?: (pos: { x: number; y: number }) => void } = {}
) => {
  const lastEventRef = useRef<PointerEvent | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const rectRef = useRef<DOMRect | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);

  /* ---------- RAF ---------- */

  const stopRAF = useCallback(() => {
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    lastEventRef.current = null;
  }, []);

  const processFrame = useCallback(() => {
    rafIdRef.current = null;
    if (!enabled || !activeRef.current || !onMove || !lastEventRef.current || !rectRef.current) {
      return;
    }

    const e = lastEventRef.current;
    const rect = rectRef.current;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    onMove({ x, y });
  }, [enabled, onMove]);

  /* ---------- visibility ---------- */

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onVisibility = () => {
      if (document.hidden) {
        activeRef.current = false;
        stopRAF();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);

    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enabled, stopRAF]);

  /* ---------- RECT OBSERVER ---------- */

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let resizeObserver = null as ResizeObserver | null;

    const updateRect = () => {
      if (elementRef.current) {
        rectRef.current = elementRef.current.getBoundingClientRect();
      }
    };

    const currentElement = containerRef.current;

    if (currentElement !== elementRef.current) {
      if (elementRef.current) {
        window.removeEventListener('resize', updateRect);
        if (resizeObserver) {
          resizeObserver.disconnect();
          resizeObserver = null;
        }
      }
      elementRef.current = currentElement;
    }

    if (elementRef.current) {
      updateRect();

      window.addEventListener('resize', updateRect);

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          updateRect();
        });
        resizeObserver.observe(elementRef.current);
      }
    }

    return () => {
      window.removeEventListener('resize', updateRect);
      if (resizeObserver && elementRef.current) {
        resizeObserver.unobserve(elementRef.current);
        resizeObserver.disconnect();
      }
    };
  }, [containerRef, enabled]);

  /* ---------- EMISOR ---------- */

  const bind = useCallback(() => {
    if (!enabled) {
      return {};
    }

    return {
      onPointerEnter() {
        activeRef.current = true;
      },
      onPointerLeave() {
        activeRef.current = false;
        stopRAF();
      },
      onPointerMove(e: React.PointerEvent) {
        if (!activeRef.current) {
          return;
        }

        lastEventRef.current = e.nativeEvent;

        if (rafIdRef.current == null) {
          rafIdRef.current = requestAnimationFrame(processFrame);
        }
      }
    };
  }, [enabled, processFrame, stopRAF]);

  /* ---------- RECEPTOR ---------- */

  const mapToPixels = useCallback(
    (pos: { x: number; y: number }): { x: number; y: number } | null => {
      if (!enabled || !rectRef.current) {
        return null;
      }

      const rect = rectRef.current;
      const px = pos.x * rect.width;
      const py = pos.y * rect.height;

      return { x: px, y: py };
    },
    [enabled]
  );

  /* ---------- cleanup ---------- */

  useEffect(() => {
    if (!enabled) {
      stopRAF();

      return;
    }

    return () => stopRAF();
  }, [enabled, stopRAF]);

  return { bind, mapToPixels };
};

export default useNormalizedCursor;
