import { useMemo } from 'react';

import { groupCorrections, messageParts, repairIcon } from '../../../../helpers/repairs';

import type { SpecCorrection } from '@plitzi/sdk-authoring';

export type ExportChangesProps = {
  corrections: SpecCorrection[];
};

/**
 * What the export tidied while reading the space, one change per row.
 *
 * Grouped by kind under a heading of its own, every change on its own line with the names in it set in code — so where
 * one ends and the next begins is never a question. Nothing here is wrong with the space: these are the leftovers an
 * older builder wrote that today's code has no word for.
 */
const ExportChanges = ({ corrections }: ExportChangesProps) => {
  const groups = useMemo(() => groupCorrections(corrections), [corrections]);

  return (
    <div className="h-full overflow-auto">
      <p className="border-b border-zinc-200 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-700/70 dark:text-zinc-400">
        Leftovers an older builder wrote, tidied on the way. The code still builds the same page.
      </p>
      {groups.map(group => (
        <section key={group.code} className="border-b border-zinc-200 last:border-b-0 dark:border-zinc-700/70">
          <h6 className="sticky top-0 flex items-center gap-2 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
            <i className={`${repairIcon(group.code)} w-3.5 text-center text-violet-500 dark:text-violet-400`} />
            {group.label}
            <span className="rounded-full bg-zinc-200 px-1.5 text-[10px] leading-4 font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
              {group.total}
            </span>
          </h6>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {group.messages.map(message => (
              <li
                key={message.text}
                className="flex items-baseline gap-3 px-4 py-2 pl-10 text-xs text-zinc-600 dark:text-zinc-300"
              >
                <span className="grow leading-5">
                  {messageParts(message.text).map(part => (
                    <span
                      key={part.key}
                      className={
                        part.code
                          ? 'rounded bg-zinc-100 px-1 py-0.5 font-mono text-[11px] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100'
                          : undefined
                      }
                    >
                      {part.text}
                    </span>
                  ))}
                </span>
                {message.count > 1 && (
                  <span className="shrink-0 text-[11px] text-zinc-400 dark:text-zinc-500">×{message.count}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

export default ExportChanges;
