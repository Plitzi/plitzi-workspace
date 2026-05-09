import clsx from 'clsx';

import type { AiMode, AiToolCall } from '@pmodules/AI/types';

export type LiveHeaderProps = {
  mode: AiMode;
  isStreaming?: boolean;
  liveThinking?: string;
  streamingText?: string;
  liveTools: AiToolCall[];
};

const LiveHeader = ({ mode, isStreaming, liveThinking, streamingText, liveTools }: LiveHeaderProps) => (
  <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
    <span
      className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', {
        'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.7)] dark:bg-emerald-400': mode === 'build',
        'bg-sky-500 shadow-[0_0_5px_rgba(14,165,233,0.7)] dark:bg-sky-400': mode === 'plan'
      })}
    />
    <span className="font-medium text-zinc-900 dark:text-zinc-100">Plitzi</span>
    {isStreaming && !liveThinking && !streamingText && liveTools.length === 0 && (
      <div className="ml-1 flex items-center gap-1">
        <span
          className={clsx('h-1 w-1 animate-bounce rounded-full [animation-delay:-0.3s]', {
            'bg-emerald-500 dark:bg-emerald-400': mode === 'build',
            'bg-sky-500 dark:bg-sky-400': mode === 'plan'
          })}
        />
        <span
          className={clsx('h-1 w-1 animate-bounce rounded-full [animation-delay:-0.15s]', {
            'bg-emerald-500 dark:bg-emerald-400': mode === 'build',
            'bg-sky-500 dark:bg-sky-400': mode === 'plan'
          })}
        />
        <span
          className={clsx('h-1 w-1 animate-bounce rounded-full', {
            'bg-emerald-500 dark:bg-emerald-400': mode === 'build',
            'bg-sky-500 dark:bg-sky-400': mode === 'plan'
          })}
        />
      </div>
    )}
  </div>
);

export default LiveHeader;
