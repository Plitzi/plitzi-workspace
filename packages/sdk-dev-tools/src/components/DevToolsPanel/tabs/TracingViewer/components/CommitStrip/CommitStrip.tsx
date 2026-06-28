import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  COMMIT_ORIGIN_BADGE,
  COMMIT_ORIGIN_LABEL,
  COMMIT_ORIGIN_LEGEND,
  commitOrigin,
  durationColor,
  formatMs,
  SSR_COMMIT_ID
} from '../../helpers';

import type { CommitEntry } from '@plitzi/sdk-shared';
import type { KeyboardEvent } from 'react';

// Past this many store paths the tooltip collapses the rest into a "+N" marker so a chatty commit can't grow it
// unboundedly.
const MAX_CAUSE_HINT = 6;

export type CommitStripProps = {
  commits: CommitEntry[];
  selectedIndex: number;
  hydrated: boolean;
  onSelect: (commitId: number) => void;
};

const CommitStrip = ({ commits, selectedIndex, hydrated, onSelect }: CommitStripProps) => {
  const selectedRef = useRef<HTMLButtonElement>(null);
  const maxDuration = useMemo(() => Math.max(1, ...commits.map(commit => commit.duration)), [commits]);
  const firstRealId = useMemo(() => commits.find(commit => commit.commitId !== SSR_COMMIT_ID)?.commitId, [commits]);

  useEffect(() => selectedRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' }), [selectedIndex]);

  const handleSelect = useCallback((commitId: number) => () => onSelect(commitId), [onSelect]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return;
      }

      // Stop it reaching the tab-level ←/→ handler, so the commit only steps once.
      event.preventDefault();
      event.stopPropagation();
      const index = selectedIndex + (event.key === 'ArrowLeft' ? -1 : 1);
      if (index >= 0 && index < commits.length) {
        onSelect(commits[index].commitId);
      }
    },
    [commits, selectedIndex, onSelect]
  );

  return (
    <div className="flex shrink-0 flex-col border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
      <div
        role="listbox"
        aria-label="Commits, total render time"
        aria-orientation="horizontal"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="flex h-20 items-end gap-1 overflow-x-auto px-2 pt-2 outline-none focus-visible:ring-1 focus-visible:ring-violet-400"
      >
        {commits.map((commit, index) => {
          const isSelected = index === selectedIndex;
          const isSsr = commit.commitId === SSR_COMMIT_ID;
          const height = isSsr ? 100 : Math.max(6, Math.round((commit.duration / maxDuration) * 100));
          const origin = commitOrigin(commit, hydrated, commit.commitId === firstRealId);
          const causes =
            commit.causes.length > 0
              ? `\nCaused by ${commit.causes.slice(0, MAX_CAUSE_HINT).join(', ')}${commit.causes.length > MAX_CAUSE_HINT ? ` +${commit.causes.length - MAX_CAUSE_HINT}` : ''}`
              : '';

          return (
            <button
              key={commit.commitId}
              ref={isSelected ? selectedRef : undefined}
              role="option"
              aria-selected={isSelected}
              onClick={handleSelect(commit.commitId)}
              title={
                isSsr
                  ? `Commit #${commit.commitId} · ${COMMIT_ORIGIN_LABEL[origin]} · no client timing · ${commit.elementCount} elements`
                  : `Commit #${commit.commitId} · ${COMMIT_ORIGIN_LABEL[origin]} · ${formatMs(commit.duration)} total · ${commit.elementCount} elements${causes}`
              }
              className="flex h-full shrink-0 flex-col items-center justify-end gap-0.5 px-0.5"
            >
              <div
                style={{ height: `${height}%` }}
                className={clsx(
                  'w-3.5 rounded-sm transition-all',
                  isSsr ? 'bg-violet-400/40' : durationColor(commit.duration),
                  {
                    'border border-dashed border-violet-400/70': isSsr,
                    'opacity-100 ring-2 ring-violet-400': isSelected,
                    'opacity-40 hover:opacity-80': !isSelected
                  }
                )}
              />
              <span
                className={clsx('text-[8px] leading-none font-semibold', {
                  'text-violet-600 dark:text-violet-300': origin === 'ssr' || origin === 'hydration',
                  'text-zinc-500 dark:text-zinc-400': origin === 'mount' || origin === 'mixed',
                  'text-transparent': origin === 'update'
                })}
              >
                {COMMIT_ORIGIN_BADGE[origin]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-x-3 gap-y-0.5 overflow-x-auto px-2 pb-1 text-[9px] text-zinc-400 dark:text-zinc-500">
        {COMMIT_ORIGIN_LEGEND.map(item => (
          <span key={item.origin} className="flex shrink-0 items-center gap-1">
            <span className="font-semibold text-zinc-500 dark:text-zinc-300">{COMMIT_ORIGIN_BADGE[item.origin]}</span>
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default CommitStrip;
