import { arc, buildRanges, CIRCUMFERENCE, CX, CY, R } from './helpers';

export type RingProps = {
  segments: number;
  gapDeg: number;
  contextLimit: number | undefined;
  usedPercent: number;
  arcOpacity: number;
  arcClassName: string;
  segmentFill: boolean;
};

const Ring = ({ segments, gapDeg, contextLimit, usedPercent, arcOpacity, arcClassName, segmentFill }: RingProps) => {
  if (segments === 0) {
    return (
      <svg viewBox="0 0 16 16" className="h-7 w-7 shrink-0 -rotate-90">
        <circle cx={CX} cy={CY} r={R} fill="none" strokeWidth="2" className="stroke-neutral-300 dark:stroke-zinc-600" />
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
            className={arcClassName}
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
        <path
          key={`t${i}`}
          d={arc(a, b)}
          fill="none"
          strokeWidth="2"
          strokeLinecap="butt"
          className="stroke-neutral-300 dark:stroke-zinc-600"
        />
      ))}
      {contextLimit &&
        ranges
          .slice(0, filledFull)
          .map(([a, b], i) => (
            <path
              key={`f${i}`}
              d={arc(a, b)}
              fill="none"
              strokeWidth="2"
              strokeLinecap="butt"
              strokeOpacity={arcOpacity}
              className={arcClassName}
            />
          ))}
      {partialPath && (
        <path
          d={partialPath}
          fill="none"
          strokeWidth="2"
          strokeLinecap="butt"
          strokeOpacity={arcOpacity}
          className={arcClassName}
        />
      )}
    </svg>
  );
};

export default Ring;
