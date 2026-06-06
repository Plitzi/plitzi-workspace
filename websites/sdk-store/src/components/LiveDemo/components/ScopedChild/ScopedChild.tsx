import { useCallback } from 'react';

import { useDemoStore } from '../../demoStore';

export type ScopedChildProps = {
  mode: 'live' | 'snapshot';
};

const ScopedChild = ({ mode }: ScopedChildProps) => {
  const [name] = useDemoStore('user.name');
  const [count] = useDemoStore('count');
  const [theme, setTheme] = useDemoStore('theme');

  const handleToggleTheme = useCallback(() => setTheme(value => (value === 'dark' ? 'light' : 'dark')), [setTheme]);

  const isLive = mode === 'live';
  const inheritedHint = isLive ? '↑ live' : 'frozen';

  return (
    <div
      className={
        isLive
          ? 'rounded-lg border border-brand-700/50 bg-brand-900/10 p-4'
          : 'rounded-lg border border-ink-600 bg-ink-950 p-4'
      }
    >
      <div className="flex items-center gap-2">
        <span className={isLive ? 'h-1.5 w-1.5 rounded-full bg-brand-400' : 'h-1.5 w-1.5 rounded-full bg-zinc-500'} />
        <span className={`font-mono text-xs font-semibold ${isLive ? 'text-brand-300' : 'text-zinc-400'}`}>
          {isLive ? 'inherit="live"' : 'inherit="snapshot"'}
        </span>
      </div>

      <dl className="mt-3 space-y-1.5 font-mono text-xs">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-zinc-500">user.name</dt>
          <dd className="text-white">
            {name} <span className={`text-[10px] ${isLive ? 'text-brand-400' : 'text-zinc-600'}`}>{inheritedHint}</span>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-zinc-500">count</dt>
          <dd className="text-white">
            {count} <span className={`text-[10px] ${isLive ? 'text-brand-400' : 'text-zinc-600'}`}>{inheritedHint}</span>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-zinc-500">theme</dt>
          <dd className="text-white">
            {theme} <span className="text-[10px] text-zinc-600">own</span>
          </dd>
        </div>
      </dl>

      <button
        onClick={handleToggleTheme}
        className="mt-3 w-full rounded-md border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs font-medium text-white transition hover:border-brand-500"
      >
        toggle own theme
      </button>
    </div>
  );
};

export default ScopedChild;
