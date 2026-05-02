import { useState } from 'react';

type ThinkingBlockProps = { text: string; durationMs?: number };

const formatDuration = (ms: number): string => {
  if (ms < 1000) {
    return 'a moment';
  }

  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) {
    return `${Math.round(totalSeconds * 10) / 10}s`;
  }

  const m = Math.floor(totalSeconds / 60);
  const s = Math.round(totalSeconds % 60);

  return `${m}m ${s}s`;
};

const ThinkingBlock = ({ text, durationMs }: ThinkingBlockProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-1">
      <button
        className="flex items-center gap-1.5 rounded px-2 py-0.5 font-mono text-xs text-zinc-400 transition-colors hover:bg-gray-100 dark:text-zinc-500 dark:hover:bg-zinc-800/60"
        onClick={() => setOpen(o => !o)}
      >
        <span>💭</span>
        <span>{durationMs ? `Thought for ${formatDuration(durationMs)}` : 'Thought for a moment'}</span>
        <span className="text-zinc-300 dark:text-zinc-600">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="mt-0.5 ml-2 border-l-2 border-gray-200 pl-3 font-mono text-xs leading-relaxed text-zinc-400 italic dark:border-zinc-700 dark:text-zinc-500">
          <span className="wrap-break-word whitespace-pre-wrap">{text}</span>
        </div>
      )}
    </div>
  );
};

export default ThinkingBlock;
