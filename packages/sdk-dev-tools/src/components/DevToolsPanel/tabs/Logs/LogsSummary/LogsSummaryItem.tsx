import classNames from 'classnames';
import { useCallback } from 'react';

import type { LogType } from '../../../../../DevToolsContext';

export type LogsSummaryItemProps = {
  className?: string;
  amount: number;
  selected: boolean;
  logType?: LogType;
  suffix?: string;
  onClick?: (logType?: LogType) => void;
};

const LogsSummaryItem = ({
  className,
  amount,
  suffix = 'Messages',
  selected,
  logType,
  onClick
}: LogsSummaryItemProps) => {
  const handleClick = useCallback(() => onClick?.(logType), [onClick, logType]);

  return (
    <div
      className={classNames('flex cursor-pointer items-center gap-3 px-2 py-1 text-sm', className, {
        'bg-gray-200': selected,
        'hover:bg-gray-200': !selected
      })}
      onClick={handleClick}
    >
      <i
        className={classNames({
          'fa-regular fa-circle-xmark text-red-400': logType === 'danger',
          'fa-solid fa-triangle-exclamation text-orange-400': logType === 'warning',
          'fa-solid fa-circle-info text-blue-400': logType === 'info',
          'fa-solid fa-check text-green-400': logType === 'success',
          'fa-solid fa-list': !logType
        })}
      />
      {amount > 0 ? amount : 'No'} {suffix}
    </div>
  );
};

export default LogsSummaryItem;
