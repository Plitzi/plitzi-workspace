import { useCallback, useState } from 'react';

import CodeBlock from '../../../CodeBlock';

import type { ReactNode } from 'react';

export type DemoPanelProps = {
  title: string;
  code: string;
  className?: string;
  children: ReactNode;
};

const DemoPanel = ({ title, code, className, children }: DemoPanelProps) => {
  const [showCode, setShowCode] = useState(false);

  const handleToggle = useCallback(() => setShowCode(value => !value), []);

  return (
    <div className={`flex min-w-0 flex-col bg-ink-900 p-6 ${className ?? ''}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <button
          onClick={handleToggle}
          className="shrink-0 rounded-md border border-ink-600 bg-ink-800 px-2 py-1 font-mono text-[11px] font-medium text-zinc-400 transition hover:border-brand-500 hover:text-white"
        >
          {showCode ? '◀ Live' : '</> Code'}
        </button>
      </div>

      {showCode ? <CodeBlock code={code} /> : children}
    </div>
  );
};

export default DemoPanel;
