// Packages
import React from 'react';

// Relatives
import LogStatus from '../../LogStatus';
import { LOG_TYPE_CUSTOM, LOG_TYPE_SUCCESS, LOG_TYPE_WARNING } from '../../../../utils/PlitziConsole';
import LogStatusIcon from '../../LogStatusIcon';

/**
 * @param {{
 *   className?: string;
 *   status: string;
 *   message?: string;
 *   nodes: object[];
 *   time: string;
 *   duration: string;
 * }} props
 * @returns {React.ReactElement}
 */
const LogInteractionHeader = props => {
  const { status, message, nodes, time, duration } = props;
  const nodesSkipped = Object.values(nodes).filter(node => node.status === 'skipped').length;
  const nodesDisabled = Object.values(nodes).filter(node => node.status === 'disabled').length;

  return (
    <div className="flex justify-between w-full text-sm">
      <div className="flex items-center gap-2">
        <div className="flex">
          <span className="font-bold">{time}</span>
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
        <div className="flex basis-0 grow">
          <div className="truncate">{message} qweqw eqwe qwe qwe </div>
        </div>
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
