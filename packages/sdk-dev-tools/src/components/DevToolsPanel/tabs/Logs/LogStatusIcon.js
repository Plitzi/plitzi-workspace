// Packages
import React from 'react';
import classNames from 'classnames';

// Relatives
import { LOG_TYPE_DANGER, LOG_TYPE_INFO, LOG_TYPE_SUCCESS, LOG_TYPE_WARNING } from '../../../../utils/PlitziConsole';

/**
 * @param {{
 *   children?: React.ReactNode;
 *   className?: string;
 *   logType: string;
 *   title?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const LogStatusIcon = props => {
  const { className, logType = LOG_TYPE_INFO, iconClassName, title, children } = props;

  return (
    <div className={classNames('flex items-center gap-1 rounded-lg text-sm', className)} title={title}>
      <i
        className={classNames(iconClassName, {
          'fa-regular fa-circle-xmark text-red-500': logType === LOG_TYPE_DANGER,
          'fa-solid fa-triangle-exclamation text-orange-500': logType === LOG_TYPE_WARNING,
          'fa-solid fa-circle-info text-blue-500': logType === LOG_TYPE_INFO,
          'fa-solid fa-check text-green-500': logType === LOG_TYPE_SUCCESS
        })}
      />
      {children}
    </div>
  );
};

export default LogStatusIcon;
