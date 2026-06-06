import { useCallback, useRef } from 'react';

import { useDemoSetter } from '../../demoStore';

const SetterDemo = () => {
  const setState = useDemoSetter();
  const renders = useRef(0);
  renders.current += 1;

  const handleIncrement = useCallback(() => setState('count', value => value + 1), [setState]);
  const handleRename = useCallback(() => setState('user.name', 'Zoe'), [setState]);

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-zinc-500">
        These write to the store, but this panel never subscribes — so it never re-renders. Watch the State panel
        change while the counter below stays put.
      </p>

      <div className="flex gap-2">
        <button
          onClick={handleIncrement}
          className="flex-1 rounded-md border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs font-medium text-white transition hover:border-brand-500"
        >
          count +1
        </button>
        <button
          onClick={handleRename}
          className="flex-1 rounded-md border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs font-medium text-white transition hover:border-brand-500"
        >
          name = Zoe
        </button>
      </div>

      <dl className="font-mono text-xs">
        <div className="flex items-center justify-between">
          <dt className="text-zinc-500">this panel rendered</dt>
          <dd className="text-white">{renders.current}×</dd>
        </div>
      </dl>
    </div>
  );
};

export default SetterDemo;
