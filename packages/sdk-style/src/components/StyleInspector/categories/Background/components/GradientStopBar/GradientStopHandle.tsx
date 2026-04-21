import clsx from 'clsx';
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';

import normalizeLeft from '../../helpers/normalizeLeft';

import type { GradientStop } from '../../helpers/backgroundParser';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';

type GradientStopHandleProps = {
  stop: GradientStop;
  selected: boolean;
  trackRef: RefObject<HTMLDivElement | null>;
  onPositionChange: (stopId: string, pct: number) => void;
  onSelect: (stopId: string) => void;
};

const GradientStopHandle = ({ stop, selected, trackRef, onPositionChange, onSelect }: GradientStopHandleProps) => {
  const handleRef = useRef<HTMLDivElement>(null);
  const isCapturing = useRef(false);
  const hasMoved = useRef(false);
  const left = useMemo(
    () =>
      normalizeLeft(
        stop.position,
        (handleRef.current?.parentNode as HTMLElement | null)?.getBoundingClientRect().width ?? Infinity
      ),
    [stop.position]
  );

  const getPct = useCallback(
    (clientX: number): number => {
      const track = trackRef.current;
      if (!track) {
        return 0;
      }

      const { left, width } = track.getBoundingClientRect();

      return Math.round(Math.max(0, Math.min(100, ((clientX - left) / width) * 100)));
    },
    [trackRef]
  );

  useLayoutEffect(() => {
    if (!isCapturing.current && handleRef.current) {
      handleRef.current.style.left = left;
    }
  }, [left]);

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      hasMoved.current = false;
      isCapturing.current = true;
      handleRef.current?.setPointerCapture(e.pointerId);
      onSelect(stop.id);
    },
    [onSelect, stop.id]
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!isCapturing.current || !handleRef.current) {
        return;
      }

      hasMoved.current = true;
      handleRef.current.style.left = `${getPct(e.clientX)}%`;
    },
    [getPct]
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
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

  return (
    <div
      ref={handleRef}
      className={clsx(
        'absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 shadow-sm',
        selected
          ? 'z-10 border-blue-500 ring-1 ring-blue-300 dark:ring-blue-700'
          : 'z-0 border-white hover:border-gray-300 dark:border-zinc-500'
      )}
      style={{ left, backgroundColor: stop.color }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      title={`${stop.color} • ${stop.position}`}
    />
  );
};

export default GradientStopHandle;
