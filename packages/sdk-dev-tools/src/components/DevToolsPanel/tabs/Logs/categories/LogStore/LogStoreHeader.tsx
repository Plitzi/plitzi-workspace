import { formatDate } from '@plitzi/sdk-shared';

import LogStatus from '../../LogStatus';

import type { ReactNode } from 'react';

export type LogStoreHeaderProps = {
  storeName?: string;
  path?: string;
  message?: ReactNode;
  time?: string | Date;
};

const LogStoreHeader = ({ storeName, path, message, time }: LogStoreHeaderProps) => (
  <div className="flex w-full justify-between text-sm">
    <div className="flex min-w-0 grow basis-0 items-center gap-3">
      <span className="font-bold">{typeof time === 'string' ? time : formatDate(time)}</span>
      <LogStatus logType="info">Store</LogStatus>
      {storeName && <span className="font-semibold text-gray-700">{storeName}</span>}
      <div className="grow basis-0 truncate font-mono text-xs text-gray-500">{path ?? message ?? '(full state)'}</div>
    </div>
  </div>
);

export default LogStoreHeader;
