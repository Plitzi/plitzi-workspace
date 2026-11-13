import clsx from 'clsx';
import { useCallback } from 'react';

import type { LogType } from '@plitzi/sdk-shared';

export type LogsSummaryItemProps = {
  className?: string;
  amount: number;
  selected: boolean;
  logType?: LogType;
  suffix?: string;
  onClick?: (logType?: LogType) => void;
};

const LogsSummaryItem = ({ className, amount, suffix = 'All', selected, logType, onClick }: LogsSummaryItemProps) => {
  const handleClick = useCallback(() => onClick?.(logType), [onClick, logType]);

  return (
    <div
      className={clsx(
        'flex cursor-pointer items-center gap-2 px-2 py-1.5 transition-colors',
        selected ? 'bg-ui-active' : 'hover:bg-ui-hover',
        className
      )}
      onClick={handleClick}
    >
      <i
        className={clsx('text-xs', {
          'fa-regular fa-circle-xmark text-red-500 dark:text-red-400': logType === 'danger',
          'fa-solid fa-triangle-exclamation text-amber-500 dark:text-amber-400': logType === 'warning',
          'fa-solid fa-circle-info text-violet-500 dark:text-violet-400': logType === 'info',
          'fa-solid fa-check text-emerald-500 dark:text-emerald-400': logType === 'success',
          'fa-solid fa-list text-ui-fg-subtle': !logType || !['danger', 'warning', 'info', 'success'].includes(logType)
        })}
      />
      <span className="text-ui-fg font-medium tabular-nums">{amount}</span>
      <span className="text-ui-fg-subtle text-xs">{suffix}</span>
    </div>
  );
};

export default LogsSummaryItem;
