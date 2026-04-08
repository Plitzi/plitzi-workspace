import { formatDate } from '@plitzi/sdk-shared';

import LogStatus from '../../LogStatus';

import type { ReactNode } from 'react';

export type LogStoreHeaderProps = {
  storeName?: string;
  path?: string;
  message?: ReactNode;
  time?: string | Date;
};

const LogStoreHeader = ({ storeName, path, message, time }: LogStoreHeaderProps) => {
  return (
    <div className="flex w-full items-center gap-2 overflow-hidden">
      <span className="shrink-0 font-mono text-zinc-400 tabular-nums dark:text-zinc-500">
        {typeof time === 'string' ? time : formatDate(time)}
      </span>
      <LogStatus logType="info">Store</LogStatus>
      {storeName && <span className="shrink-0 font-semibold text-zinc-700 dark:text-zinc-200">{storeName}</span>}
      <span className="truncate font-mono text-zinc-400 dark:text-zinc-500">{path ?? message ?? '(full state)'}</span>
    </div>
  );
};

export default LogStoreHeader;
