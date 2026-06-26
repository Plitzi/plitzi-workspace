import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { durationColor, formatMs, formatPercent, rowDuration } from '../../helpers';
import DetailSidebar from '../DetailSidebar';
import DurationLegend from '../DurationLegend';
import MetricToggle from '../MetricToggle';

import type { DurationMetric, FlameModel, FlameNode } from '../../helpers';
import type { CommitEntry } from '@plitzi/sdk-shared';
import type { KeyboardEvent } from 'react';

export type RankedListProps = {
  commit: CommitEntry;
  model: FlameModel;
  active: FlameNode | undefined;
  onSelectElement: (id: string | undefined) => void;
};

const RankedList = ({ commit, model, active, onSelectElement }: RankedListProps) => {
  const [metric, setMetric] = useState<DurationMetric>('self');
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Ranked lists only elements that actually re-rendered (like React DevTools); bubbled/hatched ones are excluded so
  // a render budget never blames an element that did no work.
  const ranked = useMemo(
    () =>
      model.nodes
        .filter(node => node.state === 'rendered')
        .sort((a, b) => rowDuration(b, metric) - rowDuration(a, metric)),
    [model, metric]
  );
  // Relative to the slowest in THIS list so the top bar always fills — never floored at 1ms (sub-ms renders would
  // otherwise leave every bar tiny).
  const max = useMemo(() => ranked.reduce((m, row) => Math.max(m, rowDuration(row, metric)), 0) || 1, [ranked, metric]);
  const selectedIndex = useMemo(() => ranked.findIndex(row => row.id === active?.id), [ranked, active]);

  useEffect(() => selectedRef.current?.scrollIntoView({ block: 'nearest' }), [active]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if ((event.key !== 'ArrowUp' && event.key !== 'ArrowDown') || ranked.length === 0) {
        return;
      }

      event.preventDefault();
      const base = selectedIndex === -1 ? 0 : selectedIndex;
      const next = Math.max(0, Math.min(ranked.length - 1, base + (event.key === 'ArrowUp' ? -1 : 1)));
      onSelectElement(ranked[next].id);
    },
    [ranked, selectedIndex, onSelectElement]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 px-2 py-1.5 text-[10px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <span className="font-medium text-zinc-700 dark:text-zinc-200">Commit #{commit.commitId}</span>
        <span>{formatMs(commit.duration)} total</span>
        <span title="Elements that re-rendered, of all in this commit's subtree">
          · {model.renderedCount} of {commit.elementCount} rendered
        </span>
        <MetricToggle className="ml-auto" metric={metric} onChange={setMetric} />
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          role="listbox"
          aria-label="Rendered elements, ranked"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className="min-h-0 flex-1 overflow-auto outline-none focus-visible:ring-1 focus-visible:ring-violet-400"
        >
          {ranked.length === 0 && (
            <div className="px-2 py-3 text-center text-[10px] text-zinc-400 dark:text-zinc-500">
              No element re-rendered in this commit
            </div>
          )}
          {ranked.map(row => {
            const value = rowDuration(row, metric);
            const isSelected = row.id === active?.id;
            const contribution = model.totalSelf > 0 ? row.selfDuration / model.totalSelf : 0;

            return (
              <button
                key={row.id}
                ref={isSelected ? selectedRef : undefined}
                role="option"
                aria-selected={isSelected}
                onClick={() => onSelectElement(row.id === active?.id ? undefined : row.id)}
                title={`${row.name} (${row.type})\n${formatMs(row.selfDuration)} self · ${formatMs(row.actualDuration)} total · ${formatMs(row.baseDuration)} base\nphase: ${row.phase ?? 'update'} · ${formatPercent(contribution)} of render work`}
                className={clsx('flex w-full items-center gap-2 px-2 py-0.5 text-left', {
                  'bg-violet-500/10': isSelected,
                  'hover:bg-zinc-50 dark:hover:bg-zinc-800/50': !isSelected
                })}
              >
                <span className="flex w-40 shrink-0 flex-col">
                  <span className="flex items-center gap-1 text-zinc-700 dark:text-zinc-200">
                    {!row.visible && (
                      <i
                        className="fa-solid fa-eye-slash shrink-0 text-[9px] text-amber-500"
                        title="Hidden (visibility)"
                      />
                    )}
                    <span className="truncate">{row.name}</span>
                  </span>
                  <span className="truncate text-[9px] text-zinc-400 dark:text-zinc-500">{row.type}</span>
                </span>
                <span
                  className={clsx('rounded px-1 text-[9px] uppercase', {
                    'bg-sky-500/15 text-sky-600 dark:text-sky-400': row.phase === 'mount',
                    'bg-amber-500/15 text-amber-600 dark:text-amber-400': row.phase !== 'mount'
                  })}
                >
                  {row.phase === 'mount' ? 'mount' : 'update'}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-sm bg-zinc-100 dark:bg-zinc-800">
                  <div
                    style={{ width: `${Math.max(2, Math.round((value / max) * 100))}%` }}
                    className={clsx('h-full rounded-sm', durationColor(value))}
                  />
                </div>
                <span
                  className="w-10 shrink-0 text-right text-[10px] text-zinc-400 tabular-nums dark:text-zinc-500"
                  title="Share of this commit's total render work"
                >
                  {formatPercent(contribution)}
                </span>
                <span className="w-12 shrink-0 text-right text-zinc-500 tabular-nums dark:text-zinc-400">
                  {formatMs(value)}
                </span>
              </button>
            );
          })}
        </div>

        {active && <DetailSidebar node={active} commit={commit} model={model} />}
      </div>

      <DurationLegend />
    </div>
  );
};

export default RankedList;
