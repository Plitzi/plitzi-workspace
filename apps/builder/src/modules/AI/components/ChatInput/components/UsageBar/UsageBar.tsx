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
  const isCritical = usedPercent >= 95;
  const isHigh = usedPercent >= 80 && usedPercent < 95;
  const isWarn = usedPercent >= 60 && usedPercent < 80;
  const arcOpacity = Math.max(0.5, Math.min(1, 0.5 + (usedPercent / 100) * 0.5));
  const outputTokens = usage?.outputTokens ?? 0;
  const tokenInfo = contextLimit
    ? `${(usage?.inputTokens ?? 0).toLocaleString()} in · ${outputTokens.toLocaleString()} out / ${contextLimit.toLocaleString()} · ${Math.round(usedPercent)}%`
    : 'Context usage';
  const pulseMode = isCritical || isHigh || isWarn ? 'segment' : usedPercent >= 30 ? 'segment' : 'none';

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
            'stroke-red-500 dark:stroke-red-400': isCritical,
            'stroke-pink-500 dark:stroke-pink-400': !isCritical && isHigh,
            'stroke-yellow-500 dark:stroke-yellow-400': !isCritical && !isHigh && isWarn,
            'stroke-sky-500 dark:stroke-sky-400': !isCritical && !isHigh && !isWarn && currentMode === 'plan',
            'stroke-emerald-500 dark:stroke-emerald-400': !isCritical && !isHigh && !isWarn && currentMode === 'build'
          })}
          segmentFill={segmentFill}
          pulseMode={pulseMode}
        />
        <span
          className={clsx('absolute inset-0 flex items-center justify-center', {
            'text-red-500 dark:text-red-400': isCritical,
            'text-pink-500 dark:text-pink-400': !isCritical && isHigh,
            'text-yellow-500 dark:text-yellow-400': !isCritical && !isHigh && isWarn
          })}
        >
          {isCritical ? (
            <svg viewBox="0 0 16 16" className="h-2.5 w-2.5">
              <path
                d="M8 2L1.5 13h13L8 2z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinejoin="round"
              />
              <path d="M8 6v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="8" cy="11" r="0.8" fill="currentColor" />
            </svg>
          ) : isHigh ? (
            <svg viewBox="0 0 16 16" className="h-2.5 w-2.5">
              <circle cx="8" cy="8" r="3.5" fill="currentColor" />
            </svg>
          ) : isWarn ? (
            <svg viewBox="0 0 16 16" className="h-2.5 w-2.5">
              <path
                d="M8 3L2 12h12L8 3z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="0.5"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </span>
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
          'stroke-red-500 dark:stroke-red-400': isCritical,
          'stroke-pink-500 dark:stroke-pink-400': !isCritical && isHigh,
          'stroke-yellow-500 dark:stroke-yellow-400': !isCritical && !isHigh && isWarn,
          'stroke-sky-500 dark:stroke-sky-400': !isCritical && !isHigh && !isWarn && currentMode === 'plan',
          'stroke-emerald-500 dark:stroke-emerald-400': !isCritical && !isHigh && !isWarn && currentMode === 'build'
        })}
        segmentFill={segmentFill}
        pulseMode={pulseMode}
      />
    </div>
  );
};

export default UsageBar;
