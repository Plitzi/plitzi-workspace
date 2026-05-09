import clsx from 'clsx';

import { useAiChatContext } from '@pmodules/AI/contexts/AiChatContext';

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

const CX = 8;
const CY = 8;
const R = 6;
const CIRCUMFERENCE = 2 * Math.PI * R;
const TRACK_CLASS = 'stroke-neutral-300 dark:stroke-zinc-600';
const SHARED_ARC = { fill: 'none', strokeWidth: '2', strokeLinecap: 'butt' as const };

const polar = (deg: number) => ({
  x: CX + R * Math.cos(((deg - 90) * Math.PI) / 180),
  y: CY + R * Math.sin(((deg - 90) * Math.PI) / 180)
});

const arc = (startDeg: number, endDeg: number): string => {
  const s = polar(startDeg);
  const e = polar(endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;

  return `M ${s.x.toFixed(3)} ${s.y.toFixed(3)} A ${R} ${R} 0 ${large} 1 ${e.x.toFixed(3)} ${e.y.toFixed(3)}`;
};

const buildRanges = (n: number, gap: number): [number, number][] => {
  const span = 360 / n;

  return Array.from({ length: n }, (_, i) => [i * span + gap / 2, (i + 1) * span - gap / 2]);
};

type RingProps = {
  segments: number;
  gapDeg: number;
  contextLimit: number | undefined;
  usedPercent: number;
  arcOpacity: number;
  arcColorClass: string;
  segmentFill: boolean;
};

const Ring = ({ segments, gapDeg, contextLimit, usedPercent, arcOpacity, arcColorClass, segmentFill }: RingProps) => {
  if (segments === 0) {
    return (
      <svg viewBox="0 0 16 16" className="h-7 w-7 shrink-0 -rotate-90">
        <circle cx={CX} cy={CY} r={R} fill="none" strokeWidth="2" className={TRACK_CLASS} />
        {contextLimit && (
          <circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - Math.min(usedPercent, 100) / 100)}
            strokeOpacity={arcOpacity}
            className={arcColorClass}
          />
        )}
      </svg>
    );
  }

  const ranges = buildRanges(segments, gapDeg);
  const exactFill = (usedPercent / 100) * segments;
  const filledFull = Math.floor(exactFill);
  const partialFrac = segmentFill ? 0 : exactFill - filledFull;

  let partialPath: string | null = null;
  if (contextLimit && partialFrac > 0 && filledFull < segments) {
    const [a, b] = ranges[filledFull];
    partialPath = arc(a, a + partialFrac * (b - a));
  }

  return (
    <svg viewBox="0 0 16 16" className="h-7 w-7 shrink-0">
      {ranges.map(([a, b], i) => (
        <path key={`t${i}`} d={arc(a, b)} {...SHARED_ARC} className={TRACK_CLASS} />
      ))}
      {contextLimit &&
        ranges
          .slice(0, filledFull)
          .map(([a, b], i) => (
            <path key={`f${i}`} d={arc(a, b)} {...SHARED_ARC} strokeOpacity={arcOpacity} className={arcColorClass} />
          ))}
      {partialPath && <path d={partialPath} {...SHARED_ARC} strokeOpacity={arcOpacity} className={arcColorClass} />}
    </svg>
  );
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

  const arcColorClass = isHigh
    ? 'stroke-pink-500 dark:stroke-pink-400'
    : isWarn
      ? 'stroke-yellow-500 dark:stroke-yellow-400'
      : currentMode === 'plan'
        ? 'stroke-sky-500 dark:stroke-sky-400'
        : 'stroke-emerald-500 dark:stroke-emerald-400';

  const tokenInfo = contextLimit
    ? `${(usage?.inputTokens ?? 0).toLocaleString()} / ${contextLimit.toLocaleString()} tokens · ${Math.round(usedPercent)}%`
    : 'Context usage';

  const ringProps = { segments, gapDeg, contextLimit, usedPercent, arcOpacity, arcColorClass, segmentFill };

  if (showCompact) {
    return (
      <button
        onClick={onCompact}
        disabled={isStreaming}
        title={`${tokenInfo} — click to compact`}
        className="relative flex shrink-0 items-center disabled:opacity-40"
      >
        <Ring {...ringProps} />
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
      <Ring {...ringProps} />
    </div>
  );
};

export default UsageBar;
