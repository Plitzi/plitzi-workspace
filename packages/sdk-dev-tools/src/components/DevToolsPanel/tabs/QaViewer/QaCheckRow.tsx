import clsx from 'clsx';
import { use, useCallback } from 'react';

import QaFindingItem from './QaFindingItem';
import { CHECKS } from '../../../../qa/checks';
import QaContext from '../../../../qa/QaContext';

import type { QaCheck } from '../../../../qa/qaSettings';

/** The most findings a check lists; the page is outlined for all of them. */
const LISTED = 40;

export type QaCheckRowProps = { check: QaCheck };

/** A check: its switch, what it looks for, how many it found — and each of them, a way to the element on the page. */
const QaCheckRow = ({ check }: QaCheckRowProps) => {
  const { settings, setCheck, findings } = use(QaContext);
  const { label, description, colour } = CHECKS[check];
  const on = settings.checks[check];
  const found = findings[check];
  // Filled in the check's colour while it is on, a ring of it while it is off.
  const dot = on ? { backgroundColor: colour } : { boxShadow: `inset 0 0 0 1.5px ${colour}` };

  const handleToggle = useCallback(() => setCheck(check, !on), [setCheck, check, on]);

  return (
    <div className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        title={description}
        className="flex w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
        onClick={handleToggle}
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={dot} />
        <span className="min-w-0 truncate font-medium text-zinc-800 dark:text-zinc-200">{label}</span>
        {on && (
          <span
            className={clsx('ml-auto rounded-full px-1.5 text-[10px] font-semibold', {
              'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400': found.length === 0,
              'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400': found.length > 0
            })}
          >
            {found.length}
          </span>
        )}
      </button>
      {on && found.length > 0 && (
        <div className="max-h-40 overflow-y-auto pb-1">
          {found.slice(0, LISTED).map((finding, index) => (
            <QaFindingItem key={`${check}-${String(index)}`} finding={finding} />
          ))}
        </div>
      )}
    </div>
  );
};

export default QaCheckRow;
