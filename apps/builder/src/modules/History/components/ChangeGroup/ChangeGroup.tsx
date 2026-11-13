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
import LineLabel from '../LineLabel';
import SaveDetail from '../SaveDetail';

import type { ChangeGroup as Group } from '../../helpers';

export type ChangeGroupProps = { group: Group; onDismiss: () => void };

/**
 * A row of the timeline: who, from where and when, and what it did — one line per thing. Unfolded, every save it groups
 * on its own, with the fields each one changed.
 */
const ChangeGroup = ({ group, onDismiss }: ChangeGroupProps) => {
  const [open, setOpen] = useState(false);
  const newest = group.changes[0];
  const lines = groupLines(group);
  const hidden = lines.length - FOLDED_LINES;

  const handleToggle = useCallback(() => setOpen(value => !value), []);

  return (
    <li className="border-ui-line border-b">
      <button
        type="button"
        className="focus-visible:ring-primary-500 hover:bg-ui-hover flex w-full cursor-pointer flex-col gap-1 px-3 py-2 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-inset"
        aria-expanded={open}
        onClick={handleToggle}
      >
        <span className="flex min-w-0 items-center gap-2 text-xs">
          <span className={clsx('shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium', ORIGIN_TONE[newest.origin])}>
            {ORIGIN_LABEL[newest.origin]}
          </span>
          <span className="text-ui-fg truncate font-medium">{authorLabel(newest)}</span>
          <span className={clsx('ml-auto shrink-0 font-mono text-[11px]', MUTED)} title="Change number">
            {groupRange(group)}
          </span>
          <span className={clsx('shrink-0 text-[11px]', MUTED)}>{formatTime(newest.at)}</span>
        </span>
        {!open && (
          <span className="text-ui-fg-muted flex flex-col">
            {lines.slice(0, FOLDED_LINES).map(line => (
              <LineLabel key={line.text} line={line} />
            ))}
          </span>
        )}
        {!open && hidden > 0 && <span className={clsx('text-[11px]', MUTED)}>{`and ${hidden} more`}</span>}
        {!open && group.changes.length > 1 && (
          <span className={clsx('text-[11px]', MUTED)}>{`${group.changes.length} saves — open to see each`}</span>
        )}
      </button>
      {open && (
        <ol className="divide-ui-line border-ui-line mx-3 mb-2 flex flex-col divide-y border-l-2 pl-2">
          {group.changes.map(change => (
            <SaveDetail key={change.seq} change={change} onDismiss={onDismiss} />
          ))}
        </ol>
      )}
    </li>
  );
};

export default ChangeGroup;
