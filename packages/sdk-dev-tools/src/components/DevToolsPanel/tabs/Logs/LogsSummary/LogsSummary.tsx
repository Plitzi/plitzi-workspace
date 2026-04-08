import clsx from 'clsx';
import { useMemo, useCallback } from 'react';

import LogsSummaryItem from './LogsSummaryItem';

import type { Orientation } from '../../../../../DevToolsContainer';
import type { Log, LogType } from '@plitzi/sdk-shared';

export type LogsSummaryProps = {
  className?: string;
  items: Log[];
  logTypeSelected?: LogType;
  orientation: Orientation;
  onClick?: (logType?: LogType) => void;
};

const LogsSummary = ({ className, orientation = 'horizontal', items, logTypeSelected, onClick }: LogsSummaryProps) => {
  const summary = useMemo(() => {
    return items.reduce<Record<string, number>>((acc, log) => {
      const { logType } = log;
      if (!acc[logType]) {
        acc[logType] = 0;
      }

      return { ...acc, [logType]: ++acc[logType] };
    }, {});
  }, [items]);

  const handleClick = useCallback((logType?: LogType) => onClick?.(logType), [onClick]);

  return (
    <div
      className={clsx(
        'flex shrink-0 border-zinc-200 select-none dark:border-zinc-700',
        orientation === 'horizontal' ? 'flex-col border-r' : 'border-b',
        className
      )}
    >
      <LogsSummaryItem onClick={handleClick} amount={items.length} selected={!logTypeSelected} />
      <LogsSummaryItem
        onClick={handleClick}
        amount={summary['danger'] ?? 0}
        suffix="Errors"
        logType="danger"
        selected={logTypeSelected === 'danger'}
      />
      <LogsSummaryItem
        onClick={handleClick}
        amount={summary['warning'] ?? 0}
        suffix="Warnings"
        logType="warning"
        selected={logTypeSelected === 'warning'}
      />
      <LogsSummaryItem
        onClick={handleClick}
        amount={summary['info'] ?? 0}
        suffix="Info"
        logType="info"
        selected={logTypeSelected === 'info'}
      />
    </div>
  );
};

export default LogsSummary;
