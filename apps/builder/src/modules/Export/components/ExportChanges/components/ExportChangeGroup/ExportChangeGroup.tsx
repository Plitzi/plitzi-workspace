import clsx from 'clsx';
import { useCallback, useState } from 'react';

import { messageParts, repairIcon } from '../../../../helpers/repairs';

import type { CorrectionGroup } from '../../../../helpers/repairs';

export type ExportChangeGroupProps = {
  group: CorrectionGroup;
};

/** One kind of change: a heading that folds it away, and every change of that kind on its own row. */
const ExportChangeGroup = ({ group }: ExportChangeGroupProps) => {
  const [open, setOpen] = useState(true);

  const handleToggle = useCallback(() => setOpen(value => !value), []);

  return (
    <section className="border-b border-zinc-200 last:border-b-0 dark:border-zinc-700/70">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        className="sticky top-0 flex w-full cursor-pointer items-center gap-2 bg-zinc-50 px-4 py-2 text-left text-xs font-semibold text-zinc-800 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700/60"
      >
        <i
          className={clsx(
            'fa-solid fa-chevron-right w-3 text-center text-[10px] text-zinc-400 transition-transform',
            open && 'rotate-90'
          )}
        />
        <i className={clsx(repairIcon(group.code), 'w-3.5 text-center text-violet-500 dark:text-violet-400')} />
        <span className="grow">{group.label}</span>
        <span className="rounded-full bg-zinc-200 px-1.5 text-[10px] leading-4 font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
          {group.total}
        </span>
      </button>
      {open && (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {group.messages.map(message => (
            <li
              key={message.text}
              className="flex items-baseline gap-3 px-4 py-2 pl-14 text-xs text-zinc-600 dark:text-zinc-300"
            >
              <span className="grow leading-5">
                {messageParts(message.text).map(part => (
                  <span
                    key={part.key}
                    className={clsx(
                      part.code &&
                        'rounded bg-zinc-100 px-1 py-0.5 font-mono text-[11px] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100'
                    )}
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
      )}
    </section>
  );
};

export default ExportChangeGroup;
