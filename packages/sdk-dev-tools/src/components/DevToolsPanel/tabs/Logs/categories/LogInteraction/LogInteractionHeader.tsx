import { LOG_TYPE_CUSTOM, LOG_TYPE_SUCCESS, LOG_TYPE_WARNING } from '../../../../../../utils/PlitziConsole';
import LogStatus from '../../LogStatus';
import LogStatusIcon from '../../LogStatusIcon';

import type { LogInteraction } from '../../../../../../DevToolsContext';
import type { ReactNode } from 'react';

export type LogInteractionHeaderProps = {
  className?: string;
  status: string;
  message?: ReactNode;
  nodes?: LogInteraction['params']['nodes'];
  time?: string;
  duration: string;
};

const LogInteractionHeader = ({ status, message, nodes, time, duration }: LogInteractionHeaderProps) => {
  const nodesSkipped = Object.values(nodes ?? {}).filter(node => node.status === 'skipped').length;
  const nodesDisabled = Object.values(nodes ?? {}).filter(node => node.status === 'disabled').length;

  return (
    <div className="flex justify-between w-full text-sm">
      <div className="flex items-center gap-3 basis-0 grow min-w-0">
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
      <div className="flex gap-3">
        {status === 'completed' && !!nodesSkipped && (
          <LogStatusIcon logType={LOG_TYPE_WARNING} title="Skipped">
            {nodesSkipped}
          </LogStatusIcon>
        )}
        {status === 'completed' && !!nodesDisabled && (
          <LogStatusIcon logType={LOG_TYPE_CUSTOM} iconClassName="fa-solid fa-ban" title="Disabled">
            {nodesDisabled}
          </LogStatusIcon>
        )}
        {duration}
      </div>
    </div>
  );
};

export default LogInteractionHeader;
