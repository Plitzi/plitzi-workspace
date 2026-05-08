import clsx from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { AiMode } from '@pmodules/AI/types';

export type LiveThinkingProps = {
  liveThinking: string;
  mode: AiMode;
};

const LiveThinking = ({ liveThinking, mode }: LiveThinkingProps) => {
  const thinkingRef = useRef<HTMLDivElement>(null);
  const [thinkingOpen, setThinkingOpen] = useState(true);

  const handleToggleThinking = useCallback(() => setThinkingOpen(o => !o), []);

  useEffect(() => {
    if (thinkingOpen && thinkingRef.current) {
      thinkingRef.current.scrollTop = thinkingRef.current.scrollHeight;
    }
  }, [liveThinking, thinkingOpen]);

  return (
    <div className="mb-0.5">
      <button
        onClick={handleToggleThinking}
        className="flex items-center gap-1.5 rounded px-1.5 py-px font-mono text-[10px] text-zinc-500 transition-colors hover:bg-neutral-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <span className="text-sky-500 dark:text-sky-400">◈</span>
        <span>Thinking…</span>
        <span
          className={clsx('inline-block h-1.5 w-1.5 animate-pulse rounded-full', {
            'bg-emerald-500 dark:bg-emerald-400': mode === 'build',
            'bg-sky-500 dark:bg-sky-400': mode === 'plan'
          })}
        />
        <span className="text-zinc-400 dark:text-zinc-600">{thinkingOpen ? '▲' : '▼'}</span>
      </button>
      {thinkingOpen && (
        <div
          ref={thinkingRef}
          className="mt-0.5 ml-2 max-h-40 overflow-y-auto border-l-2 border-neutral-300 pl-3 font-mono text-[10px] leading-snug text-zinc-400 italic dark:border-zinc-700 dark:text-zinc-600"
        >
          <span className="wrap-break-word whitespace-pre-wrap">{liveThinking}</span>
          <span
            className={clsx('ml-0.5 inline-block h-3 w-0.5 animate-pulse align-middle', {
              'bg-emerald-500 dark:bg-emerald-400': mode === 'build',
              'bg-sky-500 dark:bg-sky-400': mode === 'plan'
            })}
          />
        </div>
      )}
    </div>
  );
};

export default LiveThinking;
