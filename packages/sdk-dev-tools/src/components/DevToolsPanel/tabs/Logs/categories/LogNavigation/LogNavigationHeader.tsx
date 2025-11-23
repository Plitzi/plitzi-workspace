import { useMemo } from 'react';

import { formatDate } from '@plitzi/sdk-shared';

import LogStatus from '../../LogStatus';

import type { LogType } from '../../../../../../DevToolsContext';
import type { NavigationStatus } from '@plitzi/sdk-navigation';
import type { ReactNode } from 'react';

export type LogNavigationHeaderProps = {
  className?: string;
  status?: NavigationStatus;
  message?: ReactNode;
  time?: string | Date;
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
    <div className="flex w-full justify-between text-sm">
      <div className="flex min-w-0 grow basis-0 items-center gap-3">
        <span className="font-bold">{typeof time === 'string' ? time : formatDate(time)}</span>
        <div className="flex">
          <LogStatus logType={logType}>{statusMessage}</LogStatus>
        </div>
        <div className="grow basis-0 truncate">{message}</div>
      </div>
    </div>
  );
};

export default LogNavigationHeader;
