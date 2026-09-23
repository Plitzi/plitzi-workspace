import clsx from 'clsx';
import { useCallback, useState } from 'react';

import { authorLabel, formatTime, groupSummary, MUTED, ORIGIN_LABEL, ORIGIN_TONE } from '../../helpers';
import ChangeEntry from '../ChangeEntry';

import type { ChangeGroup as Group } from '../../helpers';

export type ChangeGroupProps = { group: Group };

/** A row of the timeline: who, from where, when and what, and unfolded, every entity it touched. */
const ChangeGroup = ({ group }: ChangeGroupProps) => {
  const [open, setOpen] = useState(false);
  const newest = group.changes[0];
  const entries = group.changes.flatMap(change =>
    change.entries.map((entry, index) => ({ key: `${change.seq}-${index}`, entry }))
  );
  const truncated = group.changes.some(change => change.truncated);

  const handleToggle = useCallback(() => setOpen(value => !value), []);

  return (
    <li className="border-b border-zinc-100 dark:border-zinc-800">
      <button
        type="button"
        className="flex w-full flex-col gap-1 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
        aria-expanded={open}
        onClick={handleToggle}
      >
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <span className={clsx('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium', ORIGIN_TONE[newest.origin])}>
            {ORIGIN_LABEL[newest.origin]}
          </span>
          <span className="truncate font-medium text-zinc-800 dark:text-zinc-100">{authorLabel(newest)}</span>
          <span className={clsx('ml-auto shrink-0 text-[11px]', MUTED)}>{formatTime(newest.at)}</span>
        </div>
        <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">{groupSummary(group)}</p>
        {group.changes.length > 1 && (
          <span className={clsx('text-[11px]', MUTED)}>{`${group.changes.length} saves`}</span>
        )}
      </button>
      {open && (
        <ul className="flex flex-col px-3 pb-2">
          {entries.map(({ key, entry }) => (
            <ChangeEntry key={key} entry={entry} />
          ))}
        </ul>
      )}
      {open && truncated && (
        <p className={clsx('px-3 pb-2 text-[11px]', MUTED)}>
          Too large to keep whole: it names what changed, without the values.
        </p>
      )}
    </li>
  );
};

export default ChangeGroup;
