import clsx from 'clsx';

import type { AiToolCall } from '@pmodules/AI/types';

export type MessageToolProps = AiToolCall;

const MessageTool = ({ name, args, status, result }: MessageToolProps) => {
  const errorMsg =
    result && typeof result === 'object' && 'error' in result
      ? String((result as Record<string, unknown>).error)
      : undefined;
  const argPreview =
    args && Object.keys(args).length > 0
      ? Object.entries(args)
          .slice(0, 2)
          .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
          .join('  ')
      : '';

  return (
    <div className="flex min-w-0 items-center gap-2 py-0.5 pl-3 font-mono text-[10px]">
      <span className="shrink-0">
        {status === 'running' && <span className="animate-spin text-yellow-500 dark:text-yellow-400">⚙</span>}
        {status === 'interrupted' && <span className="text-amber-500 dark:text-amber-400">⚠</span>}
        {(status === 'failed' || (status === 'done' && errorMsg)) && (
          <span className="text-pink-500 dark:text-pink-400">✗</span>
        )}
        {status === 'done' && !errorMsg && <span className="text-emerald-500 dark:text-emerald-400">✓</span>}
      </span>
      <span
        className={clsx('shrink-0', {
          'text-pink-500 dark:text-pink-400': status === 'failed' || (status === 'done' && !!errorMsg),
          'text-amber-500 dark:text-amber-400': status === 'interrupted',
          'text-yellow-500 dark:text-yellow-400': status === 'running',
          'text-zinc-500 dark:text-zinc-400': status === 'done' && !errorMsg
        })}
      >
        {name}
      </span>
      {argPreview && <span className="min-w-0 truncate text-zinc-400 dark:text-zinc-600">{argPreview}</span>}
      {errorMsg && <span className="truncate text-pink-500 dark:text-pink-400">{errorMsg}</span>}
    </div>
  );
};

export default MessageTool;
