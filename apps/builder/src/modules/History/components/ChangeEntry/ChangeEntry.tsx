import clsx from 'clsx';

import { detailOf, formatValue, MUTED } from '../../helpers';

import type { ChangeEntry as Entry } from '@plitzi/sdk-shared';

export type ChangeEntryProps = { entry: Entry };

/** The fields an edit changed, each as `field: before → after`. Its line above already says what the entity is. */
const ChangeEntry = ({ entry }: ChangeEntryProps) => (
  <li className="flex flex-col gap-0.5 border-l border-zinc-200 pl-2 dark:border-zinc-700">
    <span className={clsx('font-mono text-[10px]', MUTED)}>{entry.id}</span>
    {detailOf(entry).map(({ path, before, after }) => (
      <span key={path} className="flex flex-wrap items-baseline gap-x-1 font-mono text-[11px] leading-4">
        <span className={MUTED}>{`${path}:`}</span>
        {before !== undefined && (
          <span className="break-all text-red-600 line-through dark:text-red-400">{formatValue(before)}</span>
        )}
        {before !== undefined && after !== undefined && <span className={MUTED}>→</span>}
        {after !== undefined && (
          <span className="break-all text-emerald-700 dark:text-emerald-400">{formatValue(after)}</span>
        )}
      </span>
    ))}
  </li>
);

export default ChangeEntry;
