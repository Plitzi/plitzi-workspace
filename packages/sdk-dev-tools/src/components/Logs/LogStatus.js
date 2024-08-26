// Packages
import React from 'react';
import classNames from 'classnames';

// Relatives
import { LOG_TYPE_DANGER, LOG_TYPE_INFO, LOG_TYPE_SUCCESS, LOG_TYPE_WARNING } from '../../utils/PlitziConsole';

/**
 * @param {{
 *   children?: React.ReactNode;
 *   className?: string;
 *   logType: string;
 * }} props
 * @returns {React.ReactElement}
 */
const LogStatus = props => {
  const { className, logType = LOG_TYPE_INFO, iconClassName, children } = props;

  return (
    <div
      className={classNames('flex items-center gap-1 px-2 rounded-lg text-sm', className, {
        'bg-red-500 text-white': logType === LOG_TYPE_DANGER,
        'bg-orange-500 text-white': logType === LOG_TYPE_WARNING,
        'bg-blue-500 text-white': logType === LOG_TYPE_INFO,
        'bg-green-500 text-white': logType === LOG_TYPE_SUCCESS
      })}
    >
      <i
        className={classNames(iconClassName, {
          'fa-regular fa-circle-xmark': logType === LOG_TYPE_DANGER,
          'fa-solid fa-triangle-exclamation': logType === LOG_TYPE_WARNING,
          'fa-solid fa-circle-info': logType === LOG_TYPE_INFO,
          'fa-solid fa-check': logType === LOG_TYPE_SUCCESS
        })}
      />
      {!children && logType === LOG_TYPE_DANGER && 'Error'}
      {!children && logType === LOG_TYPE_INFO && 'Info'}
      {!children && logType === LOG_TYPE_SUCCESS && 'Success'}
      {!children && logType === LOG_TYPE_WARNING && 'Warning'}
      {children}
    </div>
  );
};

export default LogStatus;
