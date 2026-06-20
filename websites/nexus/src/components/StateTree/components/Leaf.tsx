import usePulseOnChange from '../usePulseOnChange';
import { type LeafPath, useDemoStore } from '../stateTreeStore';

export type LeafProps = {
  path: LeafPath;
  label: string;
  depth: number;
  watched: boolean;
  onWatch: (path: LeafPath) => void;
};

const Leaf = ({ path, label, depth, watched, onWatch }: LeafProps) => {
  const [value] = useDemoStore(path);
  const pulseKey = usePulseOnChange(value);

  return (
    <button
      type="button"
      onClick={() => onWatch(path)}
      style={{ paddingLeft: `${0.625 + depth * 1.15}rem` }}
      className={`group relative flex w-full items-center gap-2 rounded-lg border py-1.5 pr-2.5 text-left font-mono text-xs transition ${
        watched
          ? 'border-brand-500 bg-brand-500/10 text-white'
          : 'border-transparent text-zinc-400 hover:border-ink-600 hover:bg-ink-800/60'
      }`}
    >
      {pulseKey > 0 && (
        <span key={pulseKey} className="node-pulse pointer-events-none absolute inset-0 rounded-lg" aria-hidden />
      )}

      <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
        <span className={`h-1.5 w-1.5 rounded-full ${watched ? 'bg-brand-400 live-dot' : 'bg-zinc-600'}`} />
      </span>

      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className={`shrink-0 ${watched ? 'text-brand-200' : 'text-zinc-300'}`}>{label}</span>
        <span className="text-zinc-600">:</span>
        <span className="truncate text-emerald-300">{JSON.stringify(value)}</span>
      </span>

      {watched && (
        <span className="text-brand-400 shrink-0 text-[10px] tracking-wide uppercase">watching</span>
      )}
    </button>
  );
};

export default Leaf;
