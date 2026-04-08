import clsx from 'clsx';

import { useDevToolsTheme } from '../../../../DevToolsThemeContext';

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
  const { isDark } = useDevToolsTheme();

  const colorClass =
    logType === 'danger'
      ? isDark
        ? 'bg-red-500/15 text-red-400'
        : 'bg-red-50 text-red-600'
      : logType === 'warning'
        ? isDark
          ? 'bg-amber-500/15 text-amber-400'
          : 'bg-amber-50 text-amber-700'
        : logType === 'info'
          ? isDark
            ? 'bg-violet-500/15 text-violet-400'
            : 'bg-violet-50 text-violet-700'
          : logType === 'success'
            ? isDark
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-emerald-50 text-emerald-700'
            : isDark
              ? 'bg-zinc-700 text-zinc-300'
              : 'bg-zinc-100 text-zinc-600';

  return (
    <div className={clsx('flex items-center gap-1 rounded px-1.5 py-0.5 font-medium', colorClass, className)}>
      <i className={clsx(iconClassName ?? ICON[logType], 'text-[10px]')} />
      {children ?? LABEL[logType]}
    </div>
  );
};

export default LogStatus;
