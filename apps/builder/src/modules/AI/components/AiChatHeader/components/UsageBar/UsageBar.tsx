import clsx from 'clsx';

import { useAiChatContext } from '@pmodules/AI/contexts/AiChatContext';

import { fmt } from '../../helpers';

import type { AiUsage } from '@pmodules/AI/types';

export type UsageBarProps = {
  usage?: AiUsage;
  modelContextLimit?: number;
  onCompact?: () => void;
  isStreaming?: boolean;
  messageCount?: number;
};

const UsageBar = ({ usage, modelContextLimit, onCompact, isStreaming, messageCount = 0 }: UsageBarProps) => {
  const { currentMode } = useAiChatContext();
  const contextLimit = usage?.contextLimit ?? modelContextLimit;
  const usedPercent = usage?.usedPercent ?? 0;
  const showCompact = onCompact && messageCount >= 2 && usedPercent >= 60;
  const isHigh = usedPercent >= 80;
  const isWarn = usedPercent >= 60 && usedPercent < 80;

  return (
    <div className="flex items-center gap-2 px-3 pb-2">
      <span className="shrink-0 font-mono text-[9px] text-zinc-400 dark:text-zinc-500">
        {contextLimit ? `${fmt(usage?.inputTokens ?? 0)}/${fmt(contextLimit)}` : '—'}
      </span>
      <div className="h-0.5 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-zinc-800">
        <div
          className={clsx('h-full rounded-full transition-all', {
            'bg-pink-500 dark:bg-pink-400': isHigh,
            'bg-yellow-500 dark:bg-yellow-400': isWarn,
            'bg-emerald-500 dark:bg-emerald-400': currentMode === 'build' && !isHigh && !isWarn,
            'bg-sky-500 dark:bg-sky-400': currentMode === 'plan' && !isHigh && !isWarn
          })}
          style={{ width: `${Math.min(usedPercent, 100)}%` }}
        />
      </div>
      <span
        className={clsx('shrink-0 font-mono text-[9px]', {
          'text-pink-500 dark:text-pink-400': isHigh,
          'text-yellow-500 dark:text-yellow-400': isWarn,
          'text-zinc-400 dark:text-zinc-500': !isHigh && !isWarn
        })}
      >
        {contextLimit ? `${Math.round(usedPercent)}%` : '—'}
      </span>
      {showCompact && (
        <button
          onClick={onCompact}
          disabled={isStreaming}
          title="Compact conversation"
          className={clsx(
            'flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[8.5px] tracking-wider uppercase transition-colors disabled:opacity-40',
            isHigh
              ? 'border-pink-500/50 bg-pink-500/10 text-pink-500 hover:bg-pink-500/20 dark:border-pink-400/50 dark:bg-pink-400/10 dark:text-pink-400'
              : 'border-yellow-500/50 bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 dark:border-yellow-400/50 dark:bg-yellow-400/10 dark:text-yellow-400'
          )}
        >
          <span
            className={clsx('h-1 w-1 rounded-full', {
              'animate-pulse bg-pink-500 dark:bg-pink-400': isHigh,
              'animate-pulse bg-yellow-500 dark:bg-yellow-400': !isHigh
            })}
          />
          compact
        </button>
      )}
    </div>
  );
};

export default UsageBar;
