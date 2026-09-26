import clsx from 'clsx';

import { describeChange } from '@plitzi/sdk-shared/history';

import { detailedEntries, formatClock, formatTime, MUTED } from '../../helpers';
import ChangeEntry from '../ChangeEntry';
import ChangeLine from '../ChangeLine';

import type { ChangeRecord } from '../../helpers';

export type SaveDetailProps = { change: ChangeRecord };

/** One save of a row: its number and time in a narrow column, what it did beside it, and the fields each edit changed. */
const SaveDetail = ({ change }: SaveDetailProps) => {
  const entries = detailedEntries(change.entries);

  return (
    <li className="flex gap-2 py-1.5">
      <span
        className={clsx('flex w-10 shrink-0 flex-col font-mono text-[10px] leading-4', MUTED)}
        title={formatTime(change.at)}
      >
        <span>{`#${change.seq}`}</span>
        <span>{formatClock(change.at)}</span>
      </span>
      <div className="flex min-w-0 grow flex-col gap-1">
        <ul className="flex flex-col">
          {describeChange(change.entries).map(line => (
            <ChangeLine key={line.text} line={line} />
          ))}
        </ul>
        {entries.length > 0 && (
          <ul className="flex flex-col gap-1">
            {entries.map(entry => (
              <ChangeEntry key={`${entry.kind}-${entry.id}`} entry={entry} />
            ))}
          </ul>
        )}
        {change.truncated && (
          <p className={clsx('text-[11px]', MUTED)}>
            Too large to keep whole: it names what changed, without the values.
          </p>
        )}
      </div>
    </li>
  );
};

export default SaveDetail;
