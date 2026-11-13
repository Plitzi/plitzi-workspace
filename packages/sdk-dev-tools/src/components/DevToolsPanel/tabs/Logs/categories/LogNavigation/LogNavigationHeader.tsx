import { useMemo } from 'react';

import { formatDate } from '@plitzi/sdk-shared/dates';

import LogStatus from '../../LogStatus';

import type { LogType, NavigationStatus } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type LogNavigationHeaderProps = {
  className?: string;
  status?: NavigationStatus;
  message?: ReactNode;
  time?: string | Date;
};

const LogNavigationHeader = ({ status, message, time }: LogNavigationHeaderProps) => {
  const { logType, statusMessage } = useMemo<{ logType: LogType | 'custom'; statusMessage: string }>(() => {
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
    <div className="flex w-full items-center gap-2 overflow-hidden">
      <span className="text-ui-fg-subtle shrink-0 font-mono tabular-nums">
        {typeof time === 'string' ? time : formatDate(time)}
      </span>
      <LogStatus logType={logType}>{statusMessage}</LogStatus>
      <div className="text-ui-fg grow basis-0 truncate">{message}</div>
    </div>
  );
};

export default LogNavigationHeader;
