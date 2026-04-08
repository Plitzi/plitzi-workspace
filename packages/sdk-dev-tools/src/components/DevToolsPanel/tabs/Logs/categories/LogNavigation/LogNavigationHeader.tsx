import clsx from 'clsx';
import { useMemo } from 'react';

import { formatDate } from '@plitzi/sdk-shared';

import { useDevToolsTheme } from '../../../../../../DevToolsThemeContext';
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
  const { isDark } = useDevToolsTheme();

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
      <span className={clsx('shrink-0 font-mono tabular-nums', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
        {typeof time === 'string' ? time : formatDate(time)}
      </span>
      <LogStatus logType={logType}>{statusMessage}</LogStatus>
      <div className={clsx('grow basis-0 truncate', isDark ? 'text-zinc-300' : 'text-zinc-700')}>{message}</div>
    </div>
  );
};

export default LogNavigationHeader;
