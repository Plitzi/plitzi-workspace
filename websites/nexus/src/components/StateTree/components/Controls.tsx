import { useState } from 'react';

import { useDemoSetter } from '../stateTreeStore';

const NAMES = ['Carlos', 'Ada', 'Linus', 'Grace', 'Rich'];
const THEMES = ['dark', 'light'];

const Controls = () => {
  const set = useDemoSetter();
  const [nameIdx, setNameIdx] = useState(0);
  const [themeIdx, setThemeIdx] = useState(0);

  const renameUser = () => {
    const next = (nameIdx + 1) % NAMES.length;
    setNameIdx(next);
    set('user.profile.name', NAMES[next]);
  };

  const toggleTheme = () => {
    const next = (themeIdx + 1) % THEMES.length;
    setThemeIdx(next);
    set('user.settings.theme', THEMES[next]);
  };

  const addToCart = () => {
    set('cart.items', n => n + 1);
    set('cart.total', n => n + 19);
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] tracking-wide text-zinc-500 uppercase">Mutate a path — watch only its node pulse</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={renameUser}
          className="border-ink-600 bg-ink-800 hover:border-brand-500 hover:text-white rounded-lg border px-3 py-2 text-left font-mono text-[11px] text-zinc-300 transition"
        >
          <span className="text-brand-400">set</span>(<span className="text-emerald-300">'user.profile.name'</span>, …)
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          className="border-ink-600 bg-ink-800 hover:border-brand-500 hover:text-white rounded-lg border px-3 py-2 text-left font-mono text-[11px] text-zinc-300 transition"
        >
          <span className="text-brand-400">set</span>(<span className="text-emerald-300">'user.settings.theme'</span>,
          …)
        </button>
        <button
          type="button"
          onClick={addToCart}
          className="border-ink-600 bg-ink-800 hover:border-brand-500 hover:text-white rounded-lg border px-3 py-2 text-left font-mono text-[11px] text-zinc-300 transition"
        >
          <span className="text-brand-400">set</span>(<span className="text-emerald-300">'cart.items'</span>, n =&gt; n
          + 1)
        </button>
      </div>
    </div>
  );
};

export default Controls;
