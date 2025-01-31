// Packages
import React, { useMemo } from 'react';

// Relatives
import LogStatus from '../../LogStatus.js';
import {
  LOG_TYPE_CUSTOM,
  LOG_TYPE_DANGER,
  LOG_TYPE_SUCCESS,
  LOG_TYPE_WARNING
} from '../../../../../../utils/PlitziConsole.js';

/**
 * @param {{
 *   className?: string;
 *   status: string;
 *   message?: string;
 *   time: string;
 * }} props
 * @returns {React.ReactElement}
 */
const LogNavigationHeader = props => {
  const { status, message, time } = props;
  const { logType, statusMessage } = useMemo(() => {
    if (status === 'normal') {
      return { logType: LOG_TYPE_SUCCESS, statusMessage: 'Success' };
    }

    if (status === 'redirect') {
      return { logType: LOG_TYPE_WARNING, statusMessage: 'Redirected' };
    }

    if (status === 'notFound') {
      return { logType: LOG_TYPE_WARNING, statusMessage: 'Not Found' };
    }

    if (status === 'accessDenied') {
      return { logType: LOG_TYPE_DANGER, statusMessage: 'Access Denied' };
    }

    return { logType: LOG_TYPE_CUSTOM, statusMessage: '' };
  }, [status]);

  return (
    <div className="flex justify-between w-full text-sm">
      <div className="flex items-center gap-3 basis-0 grow min-w-0">
        <span className="font-bold">{time}</span>
        {logType && (
          <div className="flex">
            <LogStatus logType={logType}>{statusMessage}</LogStatus>
          </div>
        )}
        <div className="grow basis-0 truncate">{message}</div>
      </div>
    </div>
  );
};

export default LogNavigationHeader;
