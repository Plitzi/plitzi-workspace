// Packages
import React, { use, useMemo } from 'react';
import get from 'lodash/get.js';

// Monorepo
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';

/**
 * @param {{
 *   className?: string;
 *   startTime?: string;
 *   endTime?: string;
 *   duration?: string;
 *   elementId?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const LogNavigationBody = props => {
  const { elementId, startTime, endTime, duration } = props;
  const { schema } = use(SchemaContext);
  const element = useMemo(() => get(schema, `flat.${elementId}`), [schema, elementId]);

  return (
    <div className="flex gap-4 justify-around m-2">
      <div className="flex flex-col grow basis-0 gap-2 min-w-0">
        <div className="flex items-center gap-1 font-bold">
          <i className="fa-regular fa-clock" />
          Times
        </div>
        <div className="flex flex-col">
          <div className="flex gap-1">
            <span>Started:</span>
            {startTime}
          </div>
          <div className="flex gap-1">
            <span>End:</span>
            {endTime}
          </div>
          <div className="flex gap-1">
            <span>Duration:</span>
            {duration}
          </div>
        </div>
      </div>
      <div className="border-r border-gray-300" />
      <div className="flex flex-col grow basis-0 gap-2 min-w-0">
        <div className="flex items-center gap-1">
          <i className="fa-solid fa-circle-info" />
          Details
        </div>
        <div className="flex flex-col">
          <div className="flex gap-1">
            <span>Type:</span>
            <span>Navigation</span>
          </div>
          <div className="flex gap-1">
            <span>Trigger:</span>
            <span className="truncate">-</span>
          </div>
          {element && (
            <div className="flex gap-1">
              <span>Element:</span>
              <span className="truncate text-blue-500 cursor-pointer">
                {element.definition.label} [{elementId}]
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LogNavigationBody;
