import { useCallback, useRef, useState } from 'react';

import { useDemoGetter } from '../../demoStore';

const GetterDemo = () => {
  const get = useDemoGetter();
  const renders = useRef(0);
  renders.current += 1;

  const [readValue, setReadValue] = useState<number | null>(null);

  const handleRead = useCallback(() => setReadValue(get('count')), [get]);

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-zinc-500">
        Increment <code className="font-mono text-brand-300">count</code> in Controls — this panel does{' '}
        <strong className="text-zinc-300">not</strong> re-render. The getter reads the live value only when you ask.
      </p>

      <button
        onClick={handleRead}
        className="w-full rounded-md border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs font-medium text-white transition hover:border-brand-500"
      >
        read count now
      </button>

      <dl className="space-y-1.5 font-mono text-xs">
        <div className="flex items-center justify-between">
          <dt className="text-zinc-500">get('count')</dt>
          <dd className="text-brand-300">{readValue === null ? '—' : readValue}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-zinc-500">this panel rendered</dt>
          <dd className="text-white">{renders.current}×</dd>
        </div>
      </dl>
    </div>
  );
};

export default GetterDemo;
