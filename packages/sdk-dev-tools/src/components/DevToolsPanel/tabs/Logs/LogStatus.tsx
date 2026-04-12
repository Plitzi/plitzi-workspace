import clsx from 'clsx';

import type { LogType } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type LogStatusProps = {
  children?: ReactNode;
  iconClassName?: string;
  className?: string;
  logType: LogType | 'custom';
};

const ICON: Record<string, string> = {
  danger: 'fa-regular fa-circle-xmark',
  warning: 'fa-solid fa-triangle-exclamation',
  info: 'fa-solid fa-circle-info',
  success: 'fa-solid fa-check'
};

const LABEL: Record<string, string> = {
  danger: 'Error',
  warning: 'Warning',
  info: 'Info',
  success: 'Success'
};

const LogStatus = ({ className, logType = 'info', iconClassName, children }: LogStatusProps) => {
  return (
    <div
      className={clsx(
        'flex items-center gap-1 rounded px-1.5 py-0.5 font-medium',
        {
          'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400': logType === 'danger',
          'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400': logType === 'warning',
          'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400': logType === 'info',
          'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400': logType === 'success',
          'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300': ![
            'danger',
            'warning',
            'info',
            'success'
          ].includes(logType)
        },
        className
      )}
    >
      <i className={clsx(iconClassName ?? ICON[logType], 'text-[10px]')} />
      {children ?? LABEL[logType]}
    </div>
  );
};

export default LogStatus;
