import { useCallback, useState } from 'react';

import MessageTool from './components/MessageTool';

import type { AiToolCall } from '../../types';

export type MessageToolsProps = { tools: AiToolCall[]; defaultOpen?: boolean };

const MessageTools = ({ tools, defaultOpen = false }: MessageToolsProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const hasRunning = tools.some(t => t.status === 'running');
  const errorCount = tools.filter(
    t => t.status === 'failed' || !!t.error || (t.result && typeof t.result === 'object' && 'error' in t.result)
  ).length;
  const label = hasRunning
    ? 'Running tools…'
    : errorCount > 0
      ? `${tools.length - errorCount} succeeded, ${errorCount} failed`
      : `Used ${tools.length} tool${tools.length > 1 ? 's' : ''}`;

  const handleClick = useCallback(() => setOpen(state => !state), []);

  return (
    <div className="flex flex-col">
      <button
        className="flex items-center gap-1.5 rounded px-2 py-0.5 font-mono text-[10px] text-zinc-500 transition-colors hover:bg-neutral-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        onClick={handleClick}
      >
        {hasRunning && <span className="animate-spin text-yellow-500 dark:text-yellow-400">⚙</span>}
        {!hasRunning && !errorCount && <span className="text-emerald-500 dark:text-emerald-400">✓</span>}
        {!hasRunning && !!errorCount && <span className="text-pink-500 dark:text-pink-400">✗</span>}
        <span>{label}</span>
        <span className="text-zinc-400 dark:text-zinc-600">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="animate-fade-in mt-0.5 ml-2 border-l-2 border-neutral-300 dark:border-zinc-700">
          {tools.map(t => (
            <MessageTool key={t.id} {...t} />
          ))}
        </div>
      )}
    </div>
  );
};

export default MessageTools;
