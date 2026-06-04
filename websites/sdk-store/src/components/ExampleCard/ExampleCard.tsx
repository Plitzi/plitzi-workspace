import { useCallback, useState } from 'react';

import CodeBlock from '../CodeBlock';

import type { ReactNode } from 'react';

export type ExampleCardProps = {
  title: string;
  subtitle?: string;
  code: string;
  children: ReactNode;
};

const ExampleCard = ({ title, subtitle, code, children }: ExampleCardProps) => {
  const [showCode, setShowCode] = useState(false);

  const handleToggle = useCallback(() => setShowCode(value => !value), []);

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900/40">
      <div className="flex items-center justify-between gap-3 border-b border-ink-800 bg-ink-900 px-6 py-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
        </div>
        <button
          onClick={handleToggle}
          className="shrink-0 rounded-md border border-ink-600 bg-ink-800 px-2 py-1 font-mono text-[11px] font-medium text-zinc-400 transition hover:border-brand-500 hover:text-white"
        >
          {showCode ? '◀ Live' : '</> Code'}
        </button>
      </div>
      <div className="p-6">{showCode ? <CodeBlock code={code} /> : children}</div>
    </div>
  );
};

export default ExampleCard;
