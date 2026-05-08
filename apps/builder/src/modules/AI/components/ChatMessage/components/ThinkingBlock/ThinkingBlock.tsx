import { useState } from 'react';

import formatDuration from '@pmodules/AI/helpers/formatDuration';

export type ThinkingBlockProps = { text: string; durationMs?: number };

const ThinkingBlock = ({ text, durationMs }: ThinkingBlockProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-1">
      <button
        className="flex items-center gap-1.5 rounded px-1.5 py-px font-mono text-[10px] text-zinc-500 transition-colors hover:bg-neutral-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-sky-500 dark:text-sky-400">◈</span>
        <span>{durationMs ? `Thought for ${formatDuration(durationMs)}` : 'Thought for a moment'}</span>
        <span className="text-zinc-400 dark:text-zinc-600">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="mt-0.5 ml-2 border-l-2 border-neutral-300 pl-3 font-mono text-[10px] leading-snug text-zinc-400 italic dark:border-zinc-700 dark:text-zinc-600">
          <span className="wrap-break-word whitespace-pre-wrap">{text}</span>
        </div>
      )}
    </div>
  );
};

export default ThinkingBlock;
