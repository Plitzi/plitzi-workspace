import { useState } from 'react';

type ThinkingBlockProps = { text: string };

const ThinkingBlock = ({ text }: ThinkingBlockProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-1">
      <button
        className="flex items-center gap-1.5 rounded px-2 py-0.5 font-mono text-xs text-zinc-400 transition-colors hover:bg-gray-100 dark:text-zinc-500 dark:hover:bg-zinc-800/60"
        onClick={() => setOpen(o => !o)}
      >
        <span>💭</span>
        <span>Thought for a moment</span>
        <span className="text-zinc-300 dark:text-zinc-600">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="mt-0.5 ml-2 border-l-2 border-gray-200 pl-3 font-mono text-xs leading-relaxed text-zinc-400 italic dark:border-zinc-700 dark:text-zinc-500">
          {text}
        </div>
      )}
    </div>
  );
};

export default ThinkingBlock;
