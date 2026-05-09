import clsx from 'clsx';
import { useCallback } from 'react';

import { deriveTag, TAG_CLASS } from '../../helpers';

import type { AiModelInfo } from '@pmodules/AI/types';

export type ModelOptionProps = {
  model: AiModelInfo;
  isActive: boolean;
  onSelect: (id: string) => void;
};

const ModelOption = ({ model, isActive, onSelect }: ModelOptionProps) => {
  const tag = deriveTag(model.id);

  const handleClick = useCallback(() => {
    onSelect(model.id);
  }, [model.id, onSelect]);

  return (
    <button
      onClick={handleClick}
      className={clsx(
        'flex w-full items-start gap-2.5 px-2 py-2 text-left transition-colors',
        isActive ? 'bg-neutral-100 dark:bg-zinc-700' : 'hover:bg-neutral-50 dark:hover:bg-zinc-700'
      )}
    >
      <div
        className={clsx(
          'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border',
          isActive
            ? 'border-neutral-400 bg-neutral-200 text-zinc-700 dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-200'
            : 'border-neutral-200 bg-neutral-50 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500'
        )}
      >
        <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"
          />
        </svg>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[12.5px] font-medium text-zinc-900 dark:text-zinc-100">{model.name}</span>
          {tag && (
            <span
              className={clsx(
                'rounded border px-1.5 py-px font-mono text-[8.5px] tracking-wide uppercase',
                TAG_CLASS[tag]
              )}
            >
              {tag}
            </span>
          )}
          {model.supportsThinking && (
            <span className="rounded border border-violet-400/40 bg-violet-500/8 px-1.5 py-px font-mono text-[8.5px] tracking-wide text-violet-500 uppercase dark:border-violet-400/40 dark:text-violet-400">
              thinking
            </span>
          )}
          {model.free && (
            <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-px font-mono text-[8.5px] tracking-wide text-emerald-500 uppercase dark:border-emerald-400/40 dark:text-emerald-400">
              free
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          {model.providerName && (
            <span className="font-mono text-[9.5px] text-zinc-400 dark:text-zinc-600">{model.providerName}</span>
          )}
          {model.contextLimit && (
            <span className="font-mono text-[9.5px] text-zinc-400 dark:text-zinc-600">
              {(model.contextLimit / 1000).toFixed(0)}K ctx
            </span>
          )}
        </div>
      </div>

      <svg
        className={clsx('mt-1 h-3 w-3 shrink-0 text-zinc-500 dark:text-zinc-400', !isActive && 'opacity-0')}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </button>
  );
};

export default ModelOption;
