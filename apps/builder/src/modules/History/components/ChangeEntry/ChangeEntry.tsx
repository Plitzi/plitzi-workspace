import clsx from 'clsx';
import { useCallback } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';
import { chainOf } from '@pmodules/Builder/helpers/elementChain';
import useRevealElement from '@pmodules/Builder/hooks/useRevealElement';

import { fieldChanges, formatValue, KIND_LABEL, MUTED, OP_ICON, OP_TONE } from '../../helpers';

import type { ChangeEntry as Entry } from '@plitzi/sdk-shared';

export type ChangeEntryProps = { entry: Entry };

/**
 * One thing a save changed, and what exactly: an update lists each field before and after. An element still in the
 * space is a link to it — the same way the problems list takes someone to an element.
 */
const ChangeEntry = ({ entry }: ChangeEntryProps) => {
  const [flat] = useBuilderStore('schema.flat');
  const revealElement = useRevealElement();
  const reachable = entry.kind === 'element' && entry.id in flat;
  const fields = entry.op === 'update' ? fieldChanges(entry.before, entry.after) : [];

  const handleReveal = useCallback(() => {
    revealElement({ id: entry.id, ...chainOf(flat, entry.id) });
  }, [entry.id, flat, revealElement]);

  return (
    <li className="flex flex-col gap-1 py-1">
      <div className="flex min-w-0 items-center gap-2 text-xs">
        <i className={clsx('fa-solid w-3 text-[10px]', OP_ICON[entry.op], OP_TONE[entry.op])} />
        <span className={clsx('shrink-0', MUTED)}>{KIND_LABEL[entry.kind]}</span>
        {reachable && (
          <button
            type="button"
            className="truncate rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-indigo-700 hover:bg-indigo-50 dark:bg-zinc-800 dark:text-indigo-300 dark:hover:bg-zinc-700"
            title="Select this element"
            onClick={handleReveal}
          >
            {entry.id}
          </button>
        )}
        {!reachable && (
          <span className="truncate font-mono text-[11px] text-zinc-700 dark:text-zinc-200">{entry.id}</span>
        )}
      </div>
      {fields.length > 0 && (
        <ul className="ml-5 flex flex-col gap-0.5 border-l border-zinc-200 pl-2 dark:border-zinc-700">
          {fields.map(({ path, before, after }) => (
            <li key={path} className="flex flex-col font-mono text-[11px] leading-snug">
              <span className={MUTED}>{path}</span>
              {before !== undefined && (
                <span className="break-all text-red-600 line-through dark:text-red-400">{formatValue(before)}</span>
              )}
              {after !== undefined && (
                <span className="break-all text-emerald-700 dark:text-emerald-400">{formatValue(after)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};

export default ChangeEntry;
