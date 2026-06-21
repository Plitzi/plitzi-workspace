import { useEffect, useRef, useSyncExternalStore } from 'react';

import { useDebug, useRenderCount } from './heroDebug';
import { getLogSnapshot, subscribeLog } from './heroLog';

const LogStream = () => {
  const logs = useSyncExternalStore(subscribeLog, getLogSnapshot, getLogSnapshot);
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const debug = useDebug();
  const renders = useRenderCount();

  const onScroll = () => {
    const el = listRef.current;
    if (el) {
      stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    }
  };

  // Auto-follow the tail only while the reader is already near the bottom, so scrolling up to inspect history isn't
  // yanked back down.
  useEffect(() => {
    const el = listRef.current;
    if (el && stick.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs]);

  const ordered = logs.slice().reverse();

  return (
    <div className="border-ink-700/70 bg-ink-950/85 flex h-full w-full flex-col overflow-hidden border border-l-0 backdrop-blur-md">
      <div className="border-ink-800 bg-ink-900/60 flex items-center gap-2 border-b px-4 py-2.5">
        <span className="live-dot bg-emerald-400 h-1.5 w-1.5 rounded-full" />
        <span className="font-mono text-xs text-zinc-300">loggerMiddleware</span>
        {debug && <span className="ml-auto font-mono text-[10px] text-emerald-400">{renders} renders</span>}
        {!debug && <span className="ml-auto font-mono text-[10px] text-zinc-600">store change log</span>}
      </div>

      <div
        ref={listRef}
        onScroll={onScroll}
        className="flex-1 space-y-1 overflow-y-auto p-3 pb-4 font-mono text-[11px] leading-relaxed"
      >
        {ordered.length === 0 && <p className="text-zinc-600">// waiting for store writes…</p>}

        {ordered.map(entry => (
          <div key={entry.id} className="flex items-center gap-1.5">
            <span className="text-brand-400">set</span>
            <span className="text-zinc-600">(</span>
            <span className="text-emerald-300">'{entry.path}'</span>
            <span className="text-zinc-600">,</span>
            <span className="text-white">{entry.value}</span>
            <span className="text-zinc-600">)</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LogStream;
