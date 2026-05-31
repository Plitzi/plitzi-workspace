import clsx from 'clsx';
import { useCallback, useState } from 'react';

import { humanizeToolName } from './humanizeToolName';

import type { AiToolCall } from '@pmodules/AI/types';

export type MessageToolProps = AiToolCall;

const MessageTool = ({ name, args, status, result, error }: MessageToolProps) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const errorMsg =
    error ??
    (result && typeof result === 'object' && 'error' in result
      ? String((result as Record<string, unknown>).error)
      : undefined);
  const hasError = status === 'failed' || !!errorMsg;
  const hasArgs = !!args && Object.keys(args).length > 0;
  const hasResult = result !== undefined && result !== null && !errorMsg;
  const canExpand = hasArgs || hasResult;

  const details = JSON.stringify({ tool: name, ...(hasArgs ? { args } : {}), ...(hasResult ? { result } : {}) }, null, 2);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(details).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [details]);

  return (
    <div className="flex min-w-0 flex-col py-0.5 pl-3 font-mono text-[10px]">
      <button
        type="button"
        disabled={!canExpand}
        onClick={() => setExpanded(e => !e)}
        className={clsx('group flex min-w-0 items-center gap-2 text-left', { 'cursor-pointer': canExpand })}
      >
        <span className="shrink-0">
          {status === 'running' && <span className="animate-spin text-yellow-500 dark:text-yellow-400">⚙</span>}
          {status === 'interrupted' && <span className="text-amber-500 dark:text-amber-400">⚠</span>}
          {(status === 'failed' || (status !== 'running' && status !== 'interrupted' && hasError)) && (
            <span className="text-pink-500 dark:text-pink-400">✗</span>
          )}
          {status === 'done' && !errorMsg && <span className="text-emerald-500 dark:text-emerald-400">✓</span>}
        </span>
        <span
          className={clsx('min-w-0 truncate', {
            'text-pink-500 dark:text-pink-400': hasError,
            'text-amber-500 dark:text-amber-400': status === 'interrupted',
            'text-yellow-500 dark:text-yellow-400': status === 'running',
            'text-zinc-600 dark:text-zinc-300': status === 'done' && !errorMsg
          })}
        >
          {humanizeToolName(name)}
        </span>
        {canExpand && (
          <span
            className={clsx('shrink-0 text-zinc-400 transition-transform group-hover:text-zinc-600 dark:text-zinc-600 dark:group-hover:text-zinc-400', {
              'rotate-90': expanded
            })}
          >
            ›
          </span>
        )}
      </button>

      {errorMsg && (
        <div className="mt-0.5 whitespace-pre-wrap wrap-break-word pl-5 text-pink-500 dark:text-pink-400">{errorMsg}</div>
      )}

      {expanded && canExpand && (
        <div className="animate-fade-in relative mt-1 ml-5">
          <button
            type="button"
            onClick={handleCopy}
            className="absolute top-1 right-1 rounded px-1.5 py-0.5 text-[9px] text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
          >
            {copied ? 'copied' : 'copy'}
          </button>
          <pre className="max-h-60 overflow-auto rounded border border-neutral-200 bg-neutral-50 p-2 text-[10px] leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            {details}
          </pre>
        </div>
      )}
    </div>
  );
};

export default MessageTool;
