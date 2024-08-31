// Packages
import React from 'react';
import Moment from 'react-moment';

/**
 * @param {{
 *   className?: string;
 *   triggerName: string;
 *   startTime: string;
 *   endTime: string;
 *   duration?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const BodyHeader = props => {
  const { triggerName, startTime, endTime, duration } = props;

  return (
    <div className="flex justify-around items-start">
      <div className="flex flex-col grow gap-2">
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
      <div className="flex flex-col grow gap-2">
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
          {/* <div className="flex gap-1">
            <span>ID:</span>
            <span>some id here</span>
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default BodyHeader;
