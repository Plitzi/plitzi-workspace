// Packages
import React, { useCallback } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';

// Relatives
import { LOG_TYPE_DANGER, LOG_TYPE_INFO, LOG_TYPE_SUCCESS, LOG_TYPE_WARNING } from '../../../../utils/PlitziConsole';

/**
 * @param {{
 *   className?: string;
 *   logs: object[];
 *   selected: boolean;
 *   logType?: string;
 *   suffix?: string;
 *   onClick?: (logType: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const LogsSummaryItem = props => {
  const { className, amount, suffix = 'Messages', selected, logType, onClick = noop } = props;

  const handleClick = useCallback(() => onClick(logType), [onClick, logType]);

  return (
    <div
      className={classNames('flex items-center gap-3 px-2 py-1 cursor-pointer text-sm', className, {
        'bg-gray-200': selected,
        'hover:bg-gray-200': !selected
      })}
      onClick={handleClick}
    >
      <i
        className={classNames({
          'fa-regular fa-circle-xmark text-red-400': logType === LOG_TYPE_DANGER,
          'fa-solid fa-triangle-exclamation text-orange-400': logType === LOG_TYPE_WARNING,
          'fa-solid fa-circle-info text-blue-400': logType === LOG_TYPE_INFO,
          'fa-solid fa-check text-green-400': logType === LOG_TYPE_SUCCESS,
          'fa-solid fa-list': !logType
        })}
      />
      {amount > 0 ? amount : 'No'} {suffix}
    </div>
  );
};

export default LogsSummaryItem;
