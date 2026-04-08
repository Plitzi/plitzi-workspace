import clsx from 'clsx';

import { useDevToolsTheme } from '../../../../DevToolsThemeContext';

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
  const { isDark } = useDevToolsTheme();

  const iconColor =
    logType === 'danger'
      ? isDark
        ? 'text-red-400'
        : 'text-red-500'
      : logType === 'warning'
        ? isDark
          ? 'text-amber-400'
          : 'text-amber-500'
        : logType === 'info'
          ? isDark
            ? 'text-violet-400'
            : 'text-violet-500'
          : logType === 'success'
            ? isDark
              ? 'text-emerald-400'
              : 'text-emerald-500'
            : isDark
              ? 'text-zinc-400'
              : 'text-zinc-500';

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
      <i className={clsx(iconClassName ?? defaultIcon, iconColor, 'text-xs')} />
      {children}
    </div>
  );
};

export default LogStatusIcon;
