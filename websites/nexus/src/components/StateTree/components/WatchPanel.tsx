import { useRef } from 'react';

import { type LeafPath, useDemoStore } from '../stateTreeStore';

export type WatchPanelProps = {
  path: LeafPath;
};

// Subscribes to exactly the watched path and counts its own renders. Mounted with a `key={path}` by the parent, so
// the counter resets each time you pick a new path — then ticks up only when that path's value changes, never when an
// unrelated node mutates. That number is the whole pitch: a subscriber wakes only for its path.
const WatchPanel = ({ path }: WatchPanelProps) => {
  const [value] = useDemoStore(path);
  const renders = useRef(0);
  renders.current += 1;

  return (
    <div className="border-ink-700 bg-ink-950/60 rounded-xl border p-4 font-mono text-xs">
      <div className="flex items-center justify-between">
        <span className="text-zinc-500">// your component</span>
        <span className="border-brand-500/40 bg-brand-500/10 text-brand-300 rounded-full border px-2 py-0.5 text-[10px]">
          {renders.current - 1} re-renders
        </span>
      </div>

      <pre className="mt-3 leading-relaxed whitespace-pre-wrap text-zinc-200">
        <span className="text-zinc-500">const</span> [value] = <span className="text-brand-400">useStore</span>(
        <span className="text-emerald-300">'{path}'</span>);
      </pre>

      <div className="border-ink-700 mt-3 flex items-center gap-2 border-t pt-3">
        <span className="text-zinc-500">value</span>
        <span className="text-zinc-600">→</span>
        <span key={renders.current} className="stat-pop text-emerald-300">
          {JSON.stringify(value)}
        </span>
      </div>
    </div>
  );
};

export default WatchPanel;
