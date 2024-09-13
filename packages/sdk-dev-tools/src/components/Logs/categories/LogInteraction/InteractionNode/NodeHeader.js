// Packages
import React from 'react';

/**
 * @param {{
 *   className?: string;
 *   duration?: string;
 *   status?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const NodeHeader = props => {
  const { duration, status } = props;

  return (
    <div className="flex gap-1 justify-between">
      <div className="flex gap-1">
        <div className="font-bold">Duration:</div>
        {duration}
      </div>
      <div className="flex gap-1">
        <div className="font-bold">Status:</div>
        {status}
      </div>
    </div>
  );
};

export default NodeHeader;
