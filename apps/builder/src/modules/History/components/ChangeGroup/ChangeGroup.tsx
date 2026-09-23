import clsx from 'clsx';
import { useCallback, useState } from 'react';

import {
  authorLabel,
  FOLDED_LINES,
  formatTime,
  groupLines,
  groupRange,
  MUTED,
  ORIGIN_LABEL,
  ORIGIN_TONE
} from '../../helpers';
import SaveDetail from '../SaveDetail';

import type { ChangeGroup as Group } from '../../helpers';

export type ChangeGroupProps = { group: Group };

/**
 * A row of the timeline: who, from where and when, and what it did — one line per thing. Unfolded, every save it groups
 * on its own, with the fields each one changed.
 */
const ChangeGroup = ({ group }: ChangeGroupProps) => {
  const [open, setOpen] = useState(false);
  const newest = group.changes[0];
  const lines = groupLines(group);
  const hidden = lines.length - FOLDED_LINES;

  const handleToggle = useCallback(() => setOpen(value => !value), []);

  return (
    <li className="border-b border-zinc-100 dark:border-zinc-800">
      <button
        type="button"
        className="flex w-full flex-col gap-1 px-3 py-2 text-left hover:bg-zinc-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:ring-inset dark:hover:bg-zinc-800/60"
        aria-expanded={open}
        onClick={handleToggle}
      >
        <span className="flex min-w-0 items-center gap-2 text-xs">
          <span className={clsx('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium', ORIGIN_TONE[newest.origin])}>
            {ORIGIN_LABEL[newest.origin]}
          </span>
          <span className="truncate font-medium text-zinc-800 dark:text-zinc-100">{authorLabel(newest)}</span>
          <span className={clsx('ml-auto shrink-0 font-mono text-[11px]', MUTED)} title="Change number">
            {groupRange(group)}
          </span>
          <span className={clsx('shrink-0 text-[11px]', MUTED)}>{formatTime(newest.at)}</span>
        </span>
        {!open && (
          <span className="flex flex-col gap-0.5">
            {lines.slice(0, FOLDED_LINES).map(line => (
              <span key={line.text} className="text-xs leading-5 text-zinc-600 dark:text-zinc-300">
                {line.text}
              </span>
            ))}
          </span>
        )}
        {!open && hidden > 0 && <span className={clsx('text-[11px]', MUTED)}>{`and ${hidden} more`}</span>}
        {!open && group.changes.length > 1 && (
          <span className={clsx('text-[11px]', MUTED)}>{`${group.changes.length} saves — open to see each`}</span>
        )}
      </button>
      {open && (
        <ol className="mx-3 mb-2 flex flex-col divide-y divide-zinc-100 border-l-2 border-zinc-200 pl-2 dark:divide-zinc-800 dark:border-zinc-700">
          {group.changes.map(change => (
            <SaveDetail key={change.seq} change={change} />
          ))}
        </ol>
      )}
    </li>
  );
};

export default ChangeGroup;
