import { useMemo } from 'react';

import QaContrastBadge from './QaContrastBadge';
import QaSwatch from './QaSwatch';
import { summarize } from '../inspect/describe';

export type QaTooltipProps = { element: Element };

/** Above the element, or below it when there is no room above. */
const GAP = 8;

/** What the element is and how it is set, by the pointer: a browser inspector's label, for a designer. */
const QaTooltip = ({ element }: QaTooltipProps) => {
  const summary = useMemo(() => summarize(element), [element]);
  if (!summary) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  const below = rect.top < 120;

  return (
    <div
      className="pointer-events-none fixed z-[999999] flex max-w-[360px] flex-col gap-1 rounded-lg bg-zinc-900/95 px-2.5 py-2 font-mono text-[11px] leading-snug text-zinc-100 shadow-xl ring-1 ring-white/10"
      style={{
        left: Math.max(GAP, rect.left),
        ...(below ? { top: rect.bottom + GAP } : { bottom: window.innerHeight - rect.top + GAP })
      }}
    >
      <span className="flex items-center gap-2">
        <span className="truncate font-semibold text-violet-300">{summary.name}</span>
        <span className="text-zinc-400">
          {summary.width} × {summary.height}
        </span>
      </span>
      <span className="text-zinc-300">
        {summary.font} / {summary.lineHeight}
      </span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <QaSwatch colour={summary.colour} />
        {summary.background && <QaSwatch colour={summary.background} />}
        {summary.contrast && <QaContrastBadge ratio={summary.contrast.ratio} needs={summary.contrast.needs} />}
      </span>
      <span className="text-zinc-400">
        padding {summary.padding} · margin {summary.margin}
        {summary.gap && ` · gap ${summary.gap}`}
      </span>
    </div>
  );
};

export default QaTooltip;
