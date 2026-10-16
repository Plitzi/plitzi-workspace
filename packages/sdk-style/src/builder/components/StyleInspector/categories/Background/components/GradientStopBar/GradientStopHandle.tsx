import clsx from 'clsx';
import { use, useCallback, useLayoutEffect, useMemo, useRef } from 'react';

import { stopPct } from './helpers';
import { resolveTokens } from '../../../../cssValues';
import StyleInspectorContext from '../../../../StyleInspectorContext';
import normalizeLeft from '../../helpers/normalizeLeft';

import type { GradientStop } from '../../helpers/backgroundParser';
import type { KeyboardEvent, MouseEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react';

type GradientStopHandleProps = {
  stop: GradientStop;
  selected: boolean;
  trackRef: RefObject<HTMLDivElement | null>;
  onPositionChange: (stopId: string, pct: number) => void;
  onSelect: (stopId: string) => void;
  onRemove: (stopId: string) => void;
};

/**
 * A stop on the gradient: dragged along it, or moved with the arrow keys (Shift for ten at a time); Delete removes it.
 */
const GradientStopHandle = ({
  stop,
  selected,
  trackRef,
  onPositionChange,
  onSelect,
  onRemove
}: GradientStopHandleProps) => {
  const { variables } = use(StyleInspectorContext);
  const handleRef = useRef<HTMLButtonElement>(null);
  const isCapturing = useRef(false);
  const hasMoved = useRef(false);
  const left = useMemo(
    () => normalizeLeft(stop.position.split(' ')[0] ?? '', trackRef.current?.getBoundingClientRect().width ?? Infinity),
    [stop.position, trackRef]
  );
  const color = useMemo(() => resolveTokens(stop.color, variables), [stop.color, variables]);

  const getPct = useCallback(
    (clientX: number): number => {
      const track = trackRef.current;
      if (!track) {
        return 0;
      }

      const { left: trackLeft, width } = track.getBoundingClientRect();

      return Math.round(Math.max(0, Math.min(100, ((clientX - trackLeft) / width) * 100)));
    },
    [trackRef]
  );

  useLayoutEffect(() => {
    if (!isCapturing.current && handleRef.current) {
      handleRef.current.style.left = left;
    }
  }, [left]);

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      hasMoved.current = false;
      isCapturing.current = true;
      handleRef.current?.setPointerCapture(e.pointerId);
      handleRef.current?.focus();
      onSelect(stop.id);
    },
    [onSelect, stop.id]
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!isCapturing.current || !handleRef.current) {
        return;
      }

      hasMoved.current = true;
      handleRef.current.style.left = `${getPct(e.clientX)}%`;
    },
    [getPct]
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!isCapturing.current) {
        return;
      }

      isCapturing.current = false;
      if (hasMoved.current && handleRef.current) {
        const pct = getPct(e.clientX);
        handleRef.current.style.left = `${pct}%`;
        onPositionChange(stop.id, pct);
      }
    },
    [getPct, onPositionChange, stop.id]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const next = stopPct(stop.position) + (e.key === 'ArrowLeft' ? -step : step);
        onPositionChange(stop.id, Math.max(0, Math.min(100, next)));
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        // Kept from reaching the canvas, where the same keys delete the selected element.
        e.stopPropagation();
        onRemove(stop.id);
      }
    },
    [onPositionChange, onRemove, stop.id, stop.position]
  );

  // The bar under the handle adds a stop where it is clicked; a click on a stop only selects it.
  const handleClick = useCallback((e: MouseEvent) => e.stopPropagation(), []);

  return (
    <button
      ref={handleRef}
      type="button"
      className={clsx(
        'pointer-events-auto absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 shadow-md outline-none active:cursor-grabbing',
        {
          'ring-primary-500 dark:ring-primary-400 z-10 border-white ring-2': selected,
          'z-0 border-white/90 hover:border-white': !selected
        }
      )}
      style={{ left, backgroundColor: color }}
      title={`${stop.color} · ${stop.position || 'auto'} — drag, or use the arrow keys`}
      aria-label={`Color stop ${stop.color} at ${stop.position || 'auto'}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
    />
  );
};

export default GradientStopHandle;
