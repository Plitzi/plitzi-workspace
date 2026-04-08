import clsx from 'clsx';

import type { LogType } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type LogStatusIconProps = {
  children?: ReactNode;
  className?: string;
  iconClassName?: string;
  logType: LogType | 'custom';
  title?: string;
};

const LogStatusIcon = ({ className, logType = 'info', iconClassName, title, children }: LogStatusIconProps) => {
  const defaultIcon =
    logType === 'danger'
      ? 'fa-regular fa-circle-xmark'
      : logType === 'warning'
        ? 'fa-solid fa-triangle-exclamation'
        : logType === 'info'
          ? 'fa-solid fa-circle-info'
          : logType === 'success'
            ? 'fa-solid fa-check'
            : 'fa-solid fa-circle';

  return (
    <div className={clsx('flex items-center gap-1', className)} title={title}>
      <i
        className={clsx(
          iconClassName ?? defaultIcon,
          {
            'text-red-500 dark:text-red-400': logType === 'danger',
            'text-amber-500 dark:text-amber-400': logType === 'warning',
            'text-violet-500 dark:text-violet-400': logType === 'info',
            'text-emerald-500 dark:text-emerald-400': logType === 'success',
            'text-zinc-500 dark:text-zinc-400': !['danger', 'warning', 'info', 'success'].includes(logType)
          },
          'text-xs'
        )}
      />
      {children}
    </div>
  );
};

export default LogStatusIcon;
