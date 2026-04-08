import clsx from 'clsx';
import { useCallback } from 'react';

import { useDevToolsTheme } from '../../../../../DevToolsThemeContext';

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
  const { isDark } = useDevToolsTheme();
  const handleClick = useCallback(() => onClick?.(logType), [onClick, logType]);

  const iconClass =
    logType === 'danger'
      ? isDark
        ? 'fa-regular fa-circle-xmark text-red-400'
        : 'fa-regular fa-circle-xmark text-red-500'
      : logType === 'warning'
        ? isDark
          ? 'fa-solid fa-triangle-exclamation text-amber-400'
          : 'fa-solid fa-triangle-exclamation text-amber-500'
        : logType === 'info'
          ? isDark
            ? 'fa-solid fa-circle-info text-violet-400'
            : 'fa-solid fa-circle-info text-violet-500'
          : logType === 'success'
            ? isDark
              ? 'fa-solid fa-check text-emerald-400'
              : 'fa-solid fa-check text-emerald-500'
            : isDark
              ? 'fa-solid fa-list text-zinc-400'
              : 'fa-solid fa-list text-zinc-500';

  const selectedBg = isDark ? 'bg-zinc-700' : 'bg-zinc-200';
  const hoverBg = isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100';
  const countColor = isDark ? 'text-zinc-200' : 'text-zinc-700';
  const labelColor = isDark ? 'text-zinc-500' : 'text-zinc-400';

  return (
    <div
      className={clsx(
        'flex cursor-pointer items-center gap-2 px-2 py-1.5 transition-colors',
        selected ? selectedBg : hoverBg,
        className
      )}
      onClick={handleClick}
    >
      <i className={clsx('text-xs', iconClass)} />
      <span className={clsx('font-medium tabular-nums', countColor)}>{amount}</span>
      <span className={clsx('text-xs', labelColor)}>{suffix}</span>
    </div>
  );
};

export default LogsSummaryItem;
