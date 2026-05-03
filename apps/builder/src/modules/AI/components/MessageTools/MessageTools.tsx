import { useCallback, useState } from 'react';

import MessageTool from './MessageTool';

import type { AiToolCall } from '../../types';

export type MessageToolsProps = {
  tools: AiToolCall[];
  defaultOpen?: boolean;
};

const MessageTools = ({ tools, defaultOpen = false }: MessageToolsProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const hasRunning = tools.some(t => t.status === 'running');
  const errorCount = tools.filter(t => t.result && typeof t.result === 'object' && 'error' in t.result).length;
  const successCount = tools.length - errorCount;
  const label = hasRunning
    ? 'Running tools…'
    : errorCount > 0
      ? `${successCount} succeeded, ${errorCount} failed`
      : `Used ${tools.length} tool${tools.length > 1 ? 's' : ''}`;

  const handleClick = useCallback(() => setOpen(state => !state), []);

  return (
    <div className="my-1">
      <button
        className="flex items-center gap-1.5 rounded px-2 py-0.5 font-mono text-xs text-zinc-500 transition-colors hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
        onClick={handleClick}
      >
        {hasRunning && <span className="animate-spin text-amber-500 dark:text-amber-400">⚙</span>}
        {!hasRunning && !errorCount && <span className="text-emerald-600 dark:text-emerald-400">✓</span>}
        {!hasRunning && !!errorCount && <span className="text-red-600 dark:text-red-400">✗</span>}
        <span>{label}</span>
        <span className="text-zinc-300 dark:text-zinc-600">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-0.5 ml-2 border-l-2 border-gray-200 dark:border-zinc-700">
          {tools.map(t => (
            <MessageTool key={t.id} {...t} />
          ))}
        </div>
      )}
    </div>
  );
};

export default MessageTools;
