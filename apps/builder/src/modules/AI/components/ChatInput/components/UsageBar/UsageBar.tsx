import clsx from 'clsx';

import { useAiChatContext } from '@pmodules/AI/contexts/AiChatContext';

import Ring from './Ring';

import type { AiUsage } from '@pmodules/AI/types';

export type UsageBarProps = {
  usage?: AiUsage;
  modelContextLimit?: number;
  onCompact?: () => void;
  isStreaming?: boolean;
  messageCount?: number;
  segments?: number;
  gapDeg?: number;
  segmentFill?: boolean;
};

const UsageBar = ({
  usage,
  modelContextLimit,
  onCompact,
  isStreaming,
  messageCount = 0,
  segments = 4,
  gapDeg = 12,
  segmentFill = false
}: UsageBarProps) => {
  const { currentMode } = useAiChatContext();
  const contextLimit = usage?.contextLimit ?? modelContextLimit;
  const usedPercent = usage?.usedPercent ?? 0;
  const showCompact = onCompact && messageCount >= 2 && usedPercent >= 60;
  const isHigh = usedPercent >= 80;
  const isWarn = usedPercent >= 60 && usedPercent < 80;
  const arcOpacity = Math.max(0.5, Math.min(1, 0.5 + (usedPercent / 100) * 0.5));

  const tokenInfo = contextLimit
    ? `${(usage?.inputTokens ?? 0).toLocaleString()} / ${contextLimit.toLocaleString()} tokens · ${Math.round(usedPercent)}%`
    : 'Context usage';

  if (showCompact) {
    return (
      <button
        onClick={onCompact}
        disabled={isStreaming}
        title={`${tokenInfo} — click to compact`}
        className="relative flex shrink-0 items-center disabled:opacity-40"
      >
        <Ring
          segments={segments}
          gapDeg={gapDeg}
          contextLimit={contextLimit}
          usedPercent={usedPercent}
          arcOpacity={arcOpacity}
          arcClassName={clsx({
            'stroke-pink-500 dark:stroke-pink-400': isHigh,
            'stroke-yellow-500 dark:stroke-yellow-400': !isHigh && isWarn,
            'stroke-sky-500 dark:stroke-sky-400': !isHigh && !isWarn && currentMode === 'plan',
            'stroke-emerald-500 dark:stroke-emerald-400': !isHigh && !isWarn && currentMode === 'build'
          })}
          segmentFill={segmentFill}
        />
        <span
          className={clsx('absolute -top-0.5 -right-0.5 h-1.5 w-1.5 animate-pulse rounded-full', {
            'bg-pink-500 dark:bg-pink-400': isHigh,
            'bg-yellow-500 dark:bg-yellow-400': isWarn
          })}
        />
      </button>
    );
  }

  return (
    <div title={tokenInfo} className="flex shrink-0 items-center">
      <Ring
        segments={segments}
        gapDeg={gapDeg}
        contextLimit={contextLimit}
        usedPercent={usedPercent}
        arcOpacity={arcOpacity}
        arcClassName={clsx({
          'stroke-pink-500 dark:stroke-pink-400': isHigh,
          'stroke-yellow-500 dark:stroke-yellow-400': !isHigh && isWarn,
          'stroke-sky-500 dark:stroke-sky-400': !isHigh && !isWarn && currentMode === 'plan',
          'stroke-emerald-500 dark:stroke-emerald-400': !isHigh && !isWarn && currentMode === 'build'
        })}
        segmentFill={segmentFill}
      />
    </div>
  );
};

export default UsageBar;
