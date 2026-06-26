import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { buildHotspots, durationColor, formatMs } from '../../helpers';
import DurationLegend from '../DurationLegend';
import HotspotSidebar from '../HotspotSidebar';

import type { HotspotRow } from '../../helpers';
import type { CommitEntry, Element, TracingTree } from '@plitzi/sdk-shared';
import type { KeyboardEvent } from 'react';

export type HotspotsListProps = {
  commits: CommitEntry[];
  tree: TracingTree;
  flat: Record<string, Element> | undefined;
  selectedId: string | undefined;
  onSelectElement: (id: string | undefined) => void;
};

type SortKey = 'total' | 'renders' | 'avg' | 'max';

const SORTS = [
  { id: 'total', label: 'Total' },
  { id: 'renders', label: 'Renders' },
  { id: 'avg', label: 'Avg' },
  { id: 'max', label: 'Max' }
] as const;

const valueOf = (row: HotspotRow, sort: SortKey): number => {
  if (sort === 'renders') {
    return row.renders;
  }

  if (sort === 'avg') {
    return row.avgSelf;
  }

  if (sort === 'max') {
    return row.maxSelf;
  }

  return row.totalSelf;
};

const HotspotsList = ({ commits, tree, flat, selectedId, onSelectElement }: HotspotsListProps) => {
  const [sort, setSort] = useState<SortKey>('total');
  const selectedRef = useRef<HTMLButtonElement>(null);

  const rows = useMemo(
    () => buildHotspots(commits, tree, flat).sort((a, b) => valueOf(b, sort) - valueOf(a, sort)),
    [commits, tree, flat, sort]
  );
  const max = useMemo(() => rows.reduce((m, row) => Math.max(m, valueOf(row, sort)), 0) || 1, [rows, sort]);
  const sessionSelf = useMemo(() => rows.reduce((sum, row) => sum + row.totalSelf, 0), [rows]);
  const selected = useMemo(() => rows.find(row => row.id === selectedId), [rows, selectedId]);
  const selectedIndex = useMemo(() => rows.findIndex(row => row.id === selectedId), [rows, selectedId]);

  useEffect(() => selectedRef.current?.scrollIntoView({ block: 'nearest' }), [selectedId]);

  const handleSort = useCallback((next: SortKey) => () => setSort(next), []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if ((event.key !== 'ArrowUp' && event.key !== 'ArrowDown') || rows.length === 0) {
        return;
      }

      event.preventDefault();
      const base = selectedIndex === -1 ? 0 : selectedIndex;
      const next = Math.max(0, Math.min(rows.length - 1, base + (event.key === 'ArrowUp' ? -1 : 1)));
      onSelectElement(rows[next].id);
    },
    [rows, selectedIndex, onSelectElement]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 px-2 py-1.5 text-[10px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <span className="font-medium text-zinc-700 dark:text-zinc-200">Session hotspots</span>
        <span>
          · {rows.length} elements · {commits.length} commits
        </span>
        <div className="ml-auto flex items-center gap-1">
          <span>sort</span>
          {SORTS.map(item => (
            <button
              key={item.id}
              onClick={handleSort(item.id)}
              aria-pressed={sort === item.id}
              className={clsx('rounded px-1.5 py-0.5 text-[10px] font-medium', {
                'bg-violet-500 text-white': sort === item.id,
                'text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-700': sort !== item.id
              })}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          role="listbox"
          aria-label="Session hotspots"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className="min-h-0 flex-1 overflow-auto outline-none focus-visible:ring-1 focus-visible:ring-violet-400"
        >
          {rows.length === 0 && (
            <div className="px-2 py-3 text-center text-[10px] text-zinc-400 dark:text-zinc-500">
              No renders recorded yet
            </div>
          )}
          {rows.map(row => {
            const isSelected = row.id === selectedId;
            const value = valueOf(row, sort);
            const barValue = sort === 'renders' ? row.renders / max : value / max;

            return (
              <button
                key={row.id}
                ref={isSelected ? selectedRef : undefined}
                role="option"
                aria-selected={isSelected}
                onClick={() => onSelectElement(isSelected ? undefined : row.id)}
                title={`${row.name} (${row.type})\n${row.renders} renders (${row.mounts} mount)\ntotal ${formatMs(row.totalSelf)} · avg ${formatMs(row.avgSelf)} · max ${formatMs(row.maxSelf)} · last ${formatMs(row.lastSelf)}`}
                className={clsx('flex w-full items-center gap-2 px-2 py-0.5 text-left', {
                  'bg-violet-500/10': isSelected,
                  'hover:bg-zinc-50 dark:hover:bg-zinc-800/50': !isSelected
                })}
              >
                <span className="flex w-40 shrink-0 flex-col">
                  <span className="truncate text-zinc-700 dark:text-zinc-200">{row.name}</span>
                  <span className="truncate text-[9px] text-zinc-400 dark:text-zinc-500">{row.type}</span>
                </span>
                <span
                  className="w-12 shrink-0 text-right text-[10px] text-zinc-400 tabular-nums dark:text-zinc-500"
                  title="Times this element rendered itself"
                >
                  {row.renders}×
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-sm bg-zinc-100 dark:bg-zinc-800">
                  <div
                    style={{ width: `${Math.max(2, Math.round(barValue * 100))}%` }}
                    className={clsx('h-full rounded-sm', durationColor(row.maxSelf))}
                  />
                </div>
                <span className="w-14 shrink-0 text-right text-zinc-500 tabular-nums dark:text-zinc-400">
                  {sort === 'renders' ? `${row.renders}×` : formatMs(value)}
                </span>
              </button>
            );
          })}
        </div>

        {selected && <HotspotSidebar row={selected} flat={flat} sessionSelf={sessionSelf} />}
      </div>

      <DurationLegend />
    </div>
  );
};

export default HotspotsList;
