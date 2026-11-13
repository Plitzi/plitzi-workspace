import LogStatus from '../../LogStatus';

import type { InteractionStatus } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type LogInteractionHeaderProps = {
  className?: string;
  status: InteractionStatus;
  message?: ReactNode;
  time?: string;
};

const LogInteractionHeader = ({ status, message, time }: LogInteractionHeaderProps) => {
  return (
    <div className="flex w-full items-center gap-2 overflow-hidden">
      <span className="text-ui-fg-subtle shrink-0 font-mono tabular-nums">{time}</span>
      {status === 'completed' && <LogStatus logType="success">Completed</LogStatus>}
      {status === 'failed' && <LogStatus logType="danger">Failed</LogStatus>}
      {status === 'skipped' && (
        <LogStatus logType="custom" iconClassName="fa-solid fa-forward-step">
          Skipped
        </LogStatus>
      )}
      <div className="text-ui-fg grow basis-0 truncate">{message}</div>
    </div>
  );
};

export default LogInteractionHeader;
