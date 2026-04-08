import clsx from 'clsx';

import { formatDate } from '@plitzi/sdk-shared';

import { useDevToolsTheme } from '../../../../../../DevToolsThemeContext';
import LogStatus from '../../LogStatus';

import type { ReactNode } from 'react';

export type LogStoreHeaderProps = {
  storeName?: string;
  path?: string;
  message?: ReactNode;
  time?: string | Date;
};

const LogStoreHeader = ({ storeName, path, message, time }: LogStoreHeaderProps) => {
  const { isDark } = useDevToolsTheme();

  return (
    <div className="flex w-full items-center gap-2 overflow-hidden">
      <span className={clsx('shrink-0 font-mono tabular-nums', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
        {typeof time === 'string' ? time : formatDate(time)}
      </span>
      <LogStatus logType="info">Store</LogStatus>
      {storeName && (
        <span className={clsx('shrink-0 font-semibold', isDark ? 'text-zinc-200' : 'text-zinc-700')}>{storeName}</span>
      )}
      <span className={clsx('truncate font-mono', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
        {path ?? message ?? '(full state)'}
      </span>
    </div>
  );
};

export default LogStoreHeader;
