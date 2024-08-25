// Packages
import React from 'react';
import classNames from 'classnames';

// Relatives
import { LOG_TYPE_DANGER, LOG_TYPE_INFO, LOG_TYPE_SUCCESS, LOG_TYPE_WARNING } from '../../utils/PlitziConsole';

/**
 * @param {{
 *   className?: string;
 *   logType: string;
 * }} props
 * @returns {React.ReactElement}
 */
const LogStatus = props => {
  const { logType } = props;

  return (
    <div
      className={classNames('flex items-center gap-1 px-1 rounded-lg text-sm', {
        'bg-red-400 text-white': logType === LOG_TYPE_DANGER,
        'bg-orange-400 text-white': logType === LOG_TYPE_WARNING,
        'bg-blue-400 text-white': logType === LOG_TYPE_INFO,
        'bg-green-400 text-white': logType === LOG_TYPE_SUCCESS
        // 'fa-solid fa-list': !logType
      })}
    >
      <i
        className={classNames({
          'fa-regular fa-circle-xmark': logType === LOG_TYPE_DANGER,
          'fa-solid fa-triangle-exclamation': logType === LOG_TYPE_WARNING,
          'fa-solid fa-circle-info': logType === LOG_TYPE_INFO,
          'fa-solid fa-check': logType === LOG_TYPE_SUCCESS
          // 'fa-solid fa-list': !logType
        })}
      />
      {logType === LOG_TYPE_DANGER && 'Error'}
      {logType === LOG_TYPE_INFO && 'Info'}
      {logType === LOG_TYPE_SUCCESS && 'Completed'}
      {logType === LOG_TYPE_WARNING && 'Warning'}
    </div>
  );
};

export default LogStatus;
