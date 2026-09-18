import clsx from 'clsx';
import { useCallback, useMemo, useState } from 'react';

import { groupCorrections } from '../../helpers/repairs';

import type { SpecCorrection } from '@plitzi/sdk-authoring';

export type ExportRepairsProps = {
  corrections: SpecCorrection[];
};

/** How many repairs of one kind are listed before the rest are only counted. */
const SHOWN_PER_KIND = 4;

/**
 * What the export tidied on the way — an element type that no longer exists, an attribute nothing reads.
 *
 * A note rather than a warning: nothing is wrong with the space, and the code is still the same page. Folded by
 * default, so it costs one line until someone wants to know.
 */
const ExportRepairs = ({ corrections }: ExportRepairsProps) => {
  const [open, setOpen] = useState(false);
  const groups = useMemo(() => groupCorrections(corrections), [corrections]);

  const handleToggle = useCallback(() => setOpen(value => !value), []);

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 text-xs text-zinc-600 dark:border-zinc-700/70 dark:bg-zinc-800/50 dark:text-zinc-300">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left"
      >
        <i className="fa-solid fa-wand-magic-sparkles text-violet-500 dark:text-violet-400" />
        <span className="grow">
          {corrections.length} {corrections.length === 1 ? 'thing' : 'things'} tidied up while reading the space
        </span>
        <span className="text-zinc-400 dark:text-zinc-500">{open ? 'Hide' : 'Details'}</span>
        <i className={clsx('fa-solid fa-chevron-down text-[10px] transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="grid max-h-40 gap-3 overflow-auto border-t border-zinc-200 px-3 py-2 sm:grid-cols-2 dark:border-zinc-700/70">
          {groups.map(group => (
            <div key={group.code}>
              <p className="font-medium text-zinc-800 dark:text-zinc-100">
                {group.label} <span className="text-zinc-400 dark:text-zinc-500">· {group.total}</span>
              </p>
              <ul className="mt-1 space-y-0.5">
                {group.messages.slice(0, SHOWN_PER_KIND).map(message => (
                  <li key={message.text}>
                    {message.text}
                    {message.count > 1 && <span className="text-zinc-400"> ×{message.count}</span>}
                  </li>
                ))}
                {group.messages.length > SHOWN_PER_KIND && (
                  <li className="text-zinc-400">and {group.messages.length - SHOWN_PER_KIND} more</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExportRepairs;
