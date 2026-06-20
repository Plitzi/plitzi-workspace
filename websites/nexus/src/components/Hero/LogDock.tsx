import { type CSSProperties, useCallback, useRef, useState } from 'react';

import LogStream from './LogStream';

const MIN_WIDTH = 260;
const MAX_WIDTH = 560;
const HANDLE_WIDTH = 36;

// Full-height, right-docked, collapsible AND resizable. Drag the grip to set the width; the toggle slides the panel
// off-screen leaving only the handle, so the play area to its left stays clear.
const LogDock = () => {
  const [open, setOpen] = useState(true);
  const [width, setWidth] = useState(320);
  const dragging = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) {
      return;
    }

    const next = window.innerWidth - e.clientX - HANDLE_WIDTH;
    setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, next)));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  const slide: CSSProperties = { transform: open ? 'translateX(0)' : `translateX(${width}px)` };

  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 z-20 hidden lg:block">
      <div
        className="pointer-events-auto flex h-full items-stretch transition-transform duration-300 ease-out"
        style={slide}
      >
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Collapse log panel' : 'Expand log panel'}
          className="border-ink-700/70 bg-ink-900/80 hover:text-white flex w-9 flex-col items-center justify-center gap-2 self-center rounded-l-2xl border border-r-0 py-4 text-zinc-400 backdrop-blur-md transition"
        >
          <span className="text-xs">{open ? '›' : '‹'}</span>
          <span className="text-[10px] font-semibold tracking-[0.18em] text-zinc-500 [writing-mode:vertical-rl]">
            LOGS
          </span>
        </button>

        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="hover:bg-brand-500/40 w-1.5 shrink-0 cursor-ew-resize bg-transparent transition"
          aria-hidden
        />

        <div style={{ width }} className="h-full">
          <LogStream />
        </div>
      </div>
    </div>
  );
};

export default LogDock;
