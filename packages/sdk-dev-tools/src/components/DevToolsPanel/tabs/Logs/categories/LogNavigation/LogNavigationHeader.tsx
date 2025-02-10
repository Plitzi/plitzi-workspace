// Packages
import { useMemo } from 'react';

// Relatives
import LogStatus from '../../LogStatus';

// Types
import type { LogType } from '../../../../../../DevToolsContext';
import type { NavigationStatus } from '@plitzi/sdk-navigation';
import type { Moment } from 'moment';
import type { ReactNode } from 'react';

export type LogNavigationHeaderProps = {
  className?: string;
  status?: NavigationStatus;
  message?: ReactNode;
  time?: string | Moment;
};

const LogNavigationHeader = ({ status, message, time }: LogNavigationHeaderProps) => {
  const { logType, statusMessage } = useMemo<{ logType: LogType; statusMessage: string }>(() => {
    if (status === 'normal') {
      return { logType: 'success', statusMessage: 'Success' };
    }

    if (status === 'redirect') {
      return { logType: 'warning', statusMessage: 'Redirected' };
    }

    if (status === 'notFound') {
      return { logType: 'warning', statusMessage: 'Not Found' };
    }

    if (status === 'accessDenied') {
      return { logType: 'danger', statusMessage: 'Access Denied' };
    }

    return { logType: 'custom', statusMessage: '' };
  }, [status]);

  return (
    <div className="flex justify-between w-full text-sm">
      <div className="flex items-center gap-3 basis-0 grow min-w-0">
        <span className="font-bold">{typeof time === 'string' ? time : time?.format()}</span>
        <div className="flex">
          <LogStatus logType={logType}>{statusMessage}</LogStatus>
        </div>
        <div className="grow basis-0 truncate">{message}</div>
      </div>
    </div>
  );
};

export default LogNavigationHeader;
