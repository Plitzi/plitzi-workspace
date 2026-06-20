import { StoreProvider } from '@plitzi/nexus';
import { type CSSProperties, type PointerEvent, useCallback, useRef, useState } from 'react';

import { createDockStore, useDock, useDockSetter } from './dockStore';
import LogStream from './LogStream';

const MIN_WIDTH = 260;
const MAX_WIDTH = 560;
const HANDLE_WIDTH = 36;

// Full-height, right-docked, collapsible AND resizable. Open/width live in a `persistMiddleware` store, so the panel
// comes back exactly as you left it after a refresh. Drag the grip to resize; the toggle slides the panel off-screen
// leaving only the handle, so the play area to its left stays clear.
const DockPanel = () => {
  const [open] = useDock('open');
  const [width] = useDock('width');
  const set = useDockSetter();
  const dragging = useRef(false);

  const onPointerDown = useCallback((e: PointerEvent) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragging.current) {
        return;
      }

      const next = window.innerWidth - e.clientX - HANDLE_WIDTH;
      set('width', Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, next)));
    },
    [set]
  );

  const onPointerUp = useCallback((e: PointerEvent) => {
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
          onClick={() => set('open', !open)}
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

const LogDock = () => {
  const [store] = useState(createDockStore);

  return (
    <StoreProvider store={store}>
      <DockPanel />
    </StoreProvider>
  );
};

export default LogDock;
