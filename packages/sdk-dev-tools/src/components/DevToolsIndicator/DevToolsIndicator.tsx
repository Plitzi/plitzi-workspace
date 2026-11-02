import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import clsx from 'clsx';
import { use, useCallback, useMemo, useRef, useState } from 'react';

import { DEV_TOOLS_ATTRIBUTE } from '@plitzi/sdk-shared/devTools';
import { DevToolsContext } from '@plitzi/sdk-shared/devTools/react';

import { sideAt } from './sideAt';

import type { IndicatorSide } from './sideAt';
import type { LogType } from '@plitzi/sdk-shared';

export type DevToolsIndicatorProps = {
  className?: string;
  onOpen: (logType?: LogType) => void;
};

/** How far a press travels before it is a drag rather than a click. */
const DRAG_THRESHOLD = 5;

// Fixed to the viewport rather than docked: while the panel is collapsed this is the only thing the dev tools show,
// and it has to stay reachable over a page that scrolls.
const DevToolsIndicator = ({ className, onOpen }: DevToolsIndicatorProps) => {
  const { logs } = use(DevToolsContext);
  /**
   * Which bottom corner, dragged there and remembered by this browser: whatever corner it sits in, some space has its
   * own thing there — a sidebar's footer, a cookie banner — and the badge covered it on every page of that space.
   */
  const [side, setSide] = useStorage<IndicatorSide>('plitzi-sdk.dev-tools.badge-side', 'left');
  /** Where a drag started and where the pointer is now, while one is under way. */
  const [drag, setDrag] = useState<{ from: number; x: number }>();
  const press = useRef<{ x: number; dragging: boolean }>(undefined);
  const holderRef = useRef<HTMLDivElement>(null);

  const { errors, warnings } = useMemo(
    () =>
      logs.reduce(
        (acum, { logType }) => ({
          errors: logType === 'danger' ? acum.errors + 1 : acum.errors,
          warnings: logType === 'warning' ? acum.warnings + 1 : acum.warnings
        }),
        { errors: 0, warnings: 0 }
      ),
    [logs]
  );

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    press.current = { x: event.clientX, dragging: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const pressed = press.current;
    if (!pressed || (!pressed.dragging && Math.abs(event.clientX - pressed.x) < DRAG_THRESHOLD)) {
      return;
    }

    pressed.dragging = true;
    setDrag({ from: pressed.x, x: event.clientX });
  }, []);

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const container = holderRef.current?.offsetParent?.getBoundingClientRect();
      if (press.current?.dragging && container) {
        setSide(sideAt(event.clientX, container));
      }

      setDrag(undefined);
    },
    [setSide]
  );

  // Opening straight into what the badge is complaining about: errors first, then warnings, and the plain log list
  // when there is nothing wrong. A press that was a drag moved it, and opens nothing.
  const handleClick = useCallback(() => {
    const dragged = press.current?.dragging === true;
    press.current = undefined;
    if (dragged) {
      return;
    }

    if (errors > 0) {
      onOpen('danger');

      return;
    }

    if (warnings > 0) {
      onOpen('warning');

      return;
    }

    onOpen();
  }, [errors, warnings, onOpen]);

  return (
    /*
     * `absolute`, against the dev-tools container — NOT `fixed` against the window.
     *
     * The two are the same thing while the space fills the window, and stop being the same the moment it does not: in
     * the desktop app the space is one pane beside a sidebar, and a badge pinned to the window's bottom-left sat on
     * top of that sidebar, over whatever was there. The docked panel has always positioned itself inside this
     * container; this is the half that had not.
     *
     * It still does not scroll away: the container is the viewport-sized box and the space scrolls in a child of it.
     */
    <div
      ref={holderRef}
      className={clsx('absolute bottom-3 z-[1000000]', side === 'right' ? 'right-3' : 'left-3', className)}
      // Follows the pointer while dragged, from the corner it left; it lands in a corner when let go.
      style={drag ? { translate: `${String(drag.x - drag.from)}px 0` } : undefined}
      {...{ [DEV_TOOLS_ATTRIBUTE]: '' }}
    >
      <button
        className={clsx(
          'flex cursor-pointer touch-none items-center gap-2 rounded border border-zinc-200 bg-white px-2 py-1.5 text-[12px]/[16px]',
          'font-bold text-zinc-600 shadow-md transition-colors select-none hover:bg-zinc-50',
          'dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
        )}
        title="Plitzi dev tools — drag to the other corner"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
      >
        Plitzi
        {errors > 0 && (
          <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
            <i className="fa-regular fa-circle-xmark text-[11px]" />
            {errors}
          </span>
        )}
        {warnings > 0 && (
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <i className="fa-solid fa-triangle-exclamation text-[11px]" />
            {warnings}
          </span>
        )}
        {errors === 0 && warnings === 0 && <i className="fa-solid fa-terminal text-[11px] text-zinc-400" />}
      </button>
    </div>
  );
};

export default DevToolsIndicator;
