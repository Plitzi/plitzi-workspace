import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { durationColor, formatMs } from '../../helpers';

import type { CommitEntry } from '@plitzi/sdk-shared';
import type { KeyboardEvent } from 'react';

export type CommitStripProps = {
  commits: CommitEntry[];
  selectedIndex: number;
  onSelect: (commitId: number) => void;
};

// Shared, always-visible commit selector (total render time per commit). Left/Right arrows step commits.
const CommitStrip = ({ commits, selectedIndex, onSelect }: CommitStripProps) => {
  const selectedRef = useRef<HTMLButtonElement>(null);
  const maxDuration = useMemo(() => Math.max(1, ...commits.map(commit => commit.duration)), [commits]);

  useEffect(() => selectedRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' }), [selectedIndex]);

  const handleSelect = useCallback((commitId: number) => () => onSelect(commitId), [onSelect]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return;
      }

      // Handle it here and stop it reaching the tab-level ←/→ handler, so the commit only steps once.
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
    <div
      role="listbox"
      aria-label="Commits, total render time"
      aria-orientation="horizontal"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="flex h-20 shrink-0 items-end gap-1 overflow-x-auto border-b border-zinc-200 bg-zinc-50 px-2 py-2 outline-none focus-visible:ring-1 focus-visible:ring-violet-400 dark:border-zinc-800 dark:bg-zinc-900"
    >
      {commits.map((commit, index) => {
        const isSelected = index === selectedIndex;
        const height = Math.max(6, Math.round((commit.duration / maxDuration) * 100));

        return (
          <button
            key={commit.commitId}
            ref={isSelected ? selectedRef : undefined}
            role="option"
            aria-selected={isSelected}
            onClick={handleSelect(commit.commitId)}
            title={`Commit #${commit.commitId} · ${formatMs(commit.duration)} total · ${commit.elementCount} elements`}
            className="flex h-full shrink-0 flex-col justify-end px-0.5"
          >
            <div
              style={{ height: `${height}%` }}
              className={clsx('w-3.5 rounded-sm transition-all', durationColor(commit.duration), {
                'opacity-100 ring-2 ring-violet-400': isSelected,
                'opacity-40 hover:opacity-80': !isSelected
              })}
            />
          </button>
        );
      })}
    </div>
  );
};

export default CommitStrip;
