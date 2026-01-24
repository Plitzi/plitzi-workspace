import { LOG_TYPE_CUSTOM, LOG_TYPE_SUCCESS } from '../../../../../../utils/PlitziConsole';
import LogStatus from '../../LogStatus';

import type { ReactNode } from 'react';

export type LogInteractionHeaderProps = {
  className?: string;
  status: string;
  message?: ReactNode;
  time?: string;
};

const LogInteractionHeader = ({ status, message, time }: LogInteractionHeaderProps) => {
  return (
    <div className="flex w-full justify-between text-sm">
      <div className="flex min-w-0 grow basis-0 items-center gap-3">
        <span className="font-bold">{time}</span>
        <div className="flex">
          {status === 'completed' && <LogStatus logType={LOG_TYPE_SUCCESS}>Completed</LogStatus>}
          {status === 'skipped' && (
            <LogStatus
              logType={LOG_TYPE_CUSTOM}
              className="bg-gray-500 text-white"
              iconClassName="fa-solid fa-forward-step"
            >
              Skipped
            </LogStatus>
          )}
        </div>
        <div className="grow basis-0 truncate">{message}</div>
      </div>
    </div>
  );
};

export default LogInteractionHeader;
