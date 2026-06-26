import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { commitRows, durationColor, formatMs, formatPercent, rowDuration } from '../../helpers';
import DurationLegend from '../DurationLegend';
import MetricToggle from '../MetricToggle';

import type { DurationMetric } from '../../helpers';
import type { CommitEntry, Element } from '@plitzi/sdk-shared';
import type { KeyboardEvent } from 'react';

export type RankedListProps = {
  commit: CommitEntry;
  flat: Record<string, Element> | undefined;
};

const RankedList = ({ commit, flat }: RankedListProps) => {
  const [metric, setMetric] = useState<DurationMetric>('self');
  const [cursor, setCursor] = useState(0);
  const cursorRef = useRef<HTMLDivElement>(null);

  const ranked = useMemo(
    () => commitRows(commit, flat).sort((a, b) => rowDuration(b, metric) - rowDuration(a, metric)),
    [commit, flat, metric]
  );
  const max = useMemo(() => Math.max(1, ...ranked.map(row => rowDuration(row, metric))), [ranked, metric]);

  useEffect(() => setCursor(0), [commit.commitId]);
  useEffect(() => cursorRef.current?.scrollIntoView({ block: 'nearest' }), [cursor]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
        return;
      }

      event.preventDefault();
      setCursor(value => Math.max(0, Math.min(ranked.length - 1, value + (event.key === 'ArrowUp' ? -1 : 1))));
    },
    [ranked.length]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 px-2 py-1.5 text-[10px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <span className="font-medium text-zinc-700 dark:text-zinc-200">Commit #{commit.commitId}</span>
        <span>{formatMs(commit.duration)} total</span>
        <span>· {commit.elementCount} elements</span>
        <MetricToggle className="ml-auto" metric={metric} onChange={setMetric} />
      </div>

      <div
        role="listbox"
        aria-label="Rendered elements, ranked"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="min-h-0 flex-1 overflow-auto outline-none focus-visible:ring-1 focus-visible:ring-violet-400"
      >
        {ranked.map((row, index) => {
          const value = rowDuration(row, metric);
          const isCursor = index === cursor;

          return (
            <div
              key={row.id}
              ref={isCursor ? cursorRef : undefined}
              role="option"
              aria-selected={isCursor}
              title={`${row.name} · ${formatMs(row.selfDuration)} self · ${formatMs(row.actualDuration)} total · ${row.phase}`}
              className={clsx('flex items-center gap-2 px-2 py-0.5', {
                'bg-violet-500/10': isCursor,
                'hover:bg-zinc-50 dark:hover:bg-zinc-800/50': !isCursor
              })}
            >
              <span className="flex w-40 shrink-0 flex-col">
                <span className="truncate text-zinc-700 dark:text-zinc-200">{row.name}</span>
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
              <span className="w-10 shrink-0 text-right text-[10px] text-zinc-400 tabular-nums dark:text-zinc-500">
                {formatPercent(row.actualDuration / commit.duration)}
              </span>
              <span className="w-12 shrink-0 text-right text-zinc-500 tabular-nums dark:text-zinc-400">
                {formatMs(value)}
              </span>
            </div>
          );
        })}
      </div>

      <DurationLegend />
    </div>
  );
};

export default RankedList;
