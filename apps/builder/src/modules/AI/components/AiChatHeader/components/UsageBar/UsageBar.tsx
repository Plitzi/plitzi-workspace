import clsx from 'clsx';

import { useAiChatContext } from '@pmodules/AI/contexts/AiChatContext';

import { fmt } from '../../helpers';

import type { AiUsage } from '@pmodules/AI/types';

export type UsageBarProps = { usage: AiUsage };

const UsageBar = ({ usage }: UsageBarProps) => {
  const { currentMode } = useAiChatContext();

  return (
    <div className="flex items-center gap-2 px-3 pb-2">
      <div className="h-0.5 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-zinc-800">
        <div
          className={clsx('h-full rounded-full transition-all', {
            'bg-pink-500 dark:bg-pink-400': usage.usedPercent >= 80,
            'bg-yellow-500 dark:bg-yellow-400': usage.usedPercent >= 60 && usage.usedPercent < 80,
            'bg-emerald-500 dark:bg-emerald-400': currentMode === 'build' && usage.usedPercent < 60,
            'bg-sky-500 dark:bg-sky-400': currentMode === 'plan' && usage.usedPercent < 60
          })}
          style={{ width: `${Math.min(usage.usedPercent, 100)}%` }}
        />
      </div>
      <span className="shrink-0 font-mono text-[9px] text-zinc-500 dark:text-zinc-400">
        {fmt(usage.inputTokens)}/{fmt(usage.contextLimit)}
      </span>
    </div>
  );
};

export default UsageBar;
