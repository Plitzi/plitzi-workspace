import { formatDate } from '@plitzi/sdk-shared/dates';

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
      <span className="text-ui-fg-subtle shrink-0 font-mono tabular-nums">
        {typeof time === 'string' ? time : formatDate(time)}
      </span>
      <LogStatus logType="info">Store</LogStatus>
      {storeName && <span className="text-ui-fg shrink-0 font-semibold">{storeName}</span>}
      <span className="text-ui-fg-subtle truncate font-mono">{path ?? message ?? '(full state)'}</span>
    </div>
  );
};

export default LogStoreHeader;
