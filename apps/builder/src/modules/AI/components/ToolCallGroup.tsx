import { useState } from 'react';

import ToolCall from './ToolCall';

import type { AiToolCall } from '../types';

type ToolCallGroupProps = {
  tools: AiToolCall[];
  defaultOpen?: boolean;
};

const ToolCallGroup = ({ tools, defaultOpen = false }: ToolCallGroupProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const hasRunning = tools.some(t => t.status === 'running');
  const label = hasRunning ? 'Running tools…' : `Used ${tools.length} tool${tools.length > 1 ? 's' : ''}`;

  return (
    <div className="my-1">
      <button
        className="flex items-center gap-1.5 rounded px-2 py-0.5 font-mono text-xs text-zinc-500 transition-colors hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
        onClick={() => setOpen(o => !o)}
      >
        {hasRunning ? (
          <span className="animate-spin text-amber-500 dark:text-amber-400">⚙</span>
        ) : (
          <span className="text-emerald-600 dark:text-emerald-400">✓</span>
        )}
        <span>{label}</span>
        <span className="text-zinc-300 dark:text-zinc-600">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-0.5 ml-2 border-l-2 border-gray-200 dark:border-zinc-700">
          {tools.map(t => (
            <ToolCall key={t.id} {...t} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ToolCallGroup;
