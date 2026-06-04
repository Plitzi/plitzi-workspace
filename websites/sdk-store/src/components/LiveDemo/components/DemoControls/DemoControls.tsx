import { useCallback } from 'react';

import { useDemoStore } from '../../demoStore';

import type { ChangeEvent } from 'react';

const DemoControls = () => {
  const [count, setCount] = useDemoStore('count');
  const [name, setName] = useDemoStore('user.name');
  const [theme, setTheme] = useDemoStore('theme');

  const handleIncrement = useCallback(() => setCount(value => value + 1), [setCount]);
  const handleDecrement = useCallback(() => setCount(value => value - 1), [setCount]);
  const handleNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setName(event.target.value),
    [setName]
  );
  const handleToggleTheme = useCallback(
    () => setTheme(value => (value === 'dark' ? 'light' : 'dark')),
    [setTheme]
  );

  return (
    <div className="space-y-5">
      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">count</label>
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={handleDecrement}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-600 bg-ink-800 text-lg text-zinc-300 transition hover:border-brand-500 hover:text-white"
          >
            −
          </button>
          <span className="min-w-[3rem] text-center font-mono text-2xl font-bold text-white">{count}</span>
          <button
            onClick={handleIncrement}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-600 bg-ink-800 text-lg text-zinc-300 transition hover:border-brand-500 hover:text-white"
          >
            +
          </button>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">user.name</label>
        <input
          value={name}
          onChange={handleNameChange}
          className="mt-2 w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 font-mono text-sm text-white outline-none transition focus:border-brand-500"
        />
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">theme</label>
        <button
          onClick={handleToggleTheme}
          className="mt-2 flex w-full items-center justify-between rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 font-mono text-sm text-white transition hover:border-brand-500"
        >
          {theme}
          <span className="text-xs text-zinc-500">toggle →</span>
        </button>
      </div>
    </div>
  );
};

export default DemoControls;
