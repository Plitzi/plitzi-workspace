import clsx from 'clsx';
import { use, useCallback } from 'react';

import QaFindingItem from './QaFindingItem';
import QaSwitch from './QaSwitch';
import QaContext from '../../../../qa/QaContext';

import type { QaCheck } from '../../../../qa/qaSettings';

/** The most findings a check lists; the page is outlined for all of them. */
const LISTED = 30;

export type QaCheckRowProps = {
  check: QaCheck;
  label: string;
  description: string;
};

/** A check: its switch, how many it found, and the first of them — each a way to the element on the page. */
const QaCheckRow = ({ check, label, description }: QaCheckRowProps) => {
  const { settings, setCheck, findings } = use(QaContext);
  const on = settings.checks[check];
  const found = findings[check];

  const handleToggle = useCallback(() => setCheck(check, !on), [setCheck, check, on]);

  return (
    <div>
      <QaSwitch
        label={label}
        description={description}
        on={on}
        onToggle={handleToggle}
        extra={
          on && (
            <span
              className={clsx('rounded-full px-1.5 text-[10px] font-semibold', {
                'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400': found.length === 0,
                'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400': found.length > 0
              })}
            >
              {found.length}
            </span>
          )
        }
      />
      {on &&
        found
          .slice(0, LISTED)
          .map((finding, index) => <QaFindingItem key={`${check}-${String(index)}`} finding={finding} />)}
    </div>
  );
};

export default QaCheckRow;
