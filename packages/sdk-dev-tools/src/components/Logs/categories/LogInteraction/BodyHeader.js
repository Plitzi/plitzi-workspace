// Packages
import React, { use, useMemo } from 'react';
import Moment from 'react-moment';

// Relatives
import DevToolsContext from '../../../../DevToolsContext';

/**
 * @param {{
 *   className?: string;
 *   triggerName: string;
 *   startTime: string;
 *   endTime: string;
 *   duration?: string;
 *   elementId?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const BodyHeader = props => {
  const { triggerName, startTime, endTime, duration, elementId } = props;
  const { getData } = use(DevToolsContext);
  const element = useMemo(() => getData('getElement', elementId), [getData, elementId]);

  return (
    <div className="flex gap-4 justify-around">
      <div className="flex flex-col grow basis-0 gap-2">
        <div className="flex items-center gap-1 font-bold">
          <i className="fa-regular fa-clock" />
          Times
        </div>
        <div className="flex flex-col">
          <div className="flex gap-1">
            <span>Started:</span>
            <Moment format="HH:mm:ss.SSS">{startTime}</Moment>
          </div>
          <div className="flex gap-1">
            <span>End:</span>
            <Moment format="HH:mm:ss.SSS">{endTime}</Moment>
          </div>
          <div className="flex gap-1">
            <span>Duration:</span>
            {duration}
          </div>
        </div>
      </div>
      <div className="border-r border-gray-300" />
      <div className="flex flex-col grow basis-0 gap-2">
        <div className="flex items-center gap-1">
          <i className="fa-solid fa-circle-info" />
          Details
        </div>
        <div className="flex flex-col">
          <div className="flex gap-1">
            <span>Type:</span>
            <span>Interaction</span>
          </div>
          <div className="flex gap-1">
            <span>Trigger:</span>
            <span>{triggerName}</span>
          </div>
          <div className="flex gap-1">
            <span>Element:</span>
            <span>
              {element?.definition.label} [{elementId}]
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BodyHeader;
