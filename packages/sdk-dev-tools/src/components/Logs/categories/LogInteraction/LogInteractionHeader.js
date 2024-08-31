// Packages
import React from 'react';

// Relatives
import LogStatus from '../../LogStatus';
import { LOG_TYPE_CUSTOM, LOG_TYPE_SUCCESS, LOG_TYPE_WARNING } from '../../../../utils/PlitziConsole';

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
        {message}
        {status === 'completed' && !!nodesSkipped && <LogStatus logType={LOG_TYPE_WARNING}>Partial Skip</LogStatus>}
        {status === 'completed' && !!nodesDisabled && (
          <LogStatus logType={LOG_TYPE_CUSTOM} className="bg-gray-200" iconClassName="fa-solid fa-ban">
            Partial Disable
          </LogStatus>
        )}
      </div>
      {duration}
    </div>
  );
};

export default LogInteractionHeader;
