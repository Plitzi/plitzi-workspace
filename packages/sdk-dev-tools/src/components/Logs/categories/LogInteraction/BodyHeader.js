// Packages
import React, { use, useCallback, useMemo } from 'react';
import Moment from 'react-moment';
import get from 'lodash/get';

// Monorepo
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';

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
  const { schema } = use(SchemaContext);
  const element = useMemo(() => get(schema, `flat.${elementId}`), [schema, elementId]);
  const elementDOM = useMemo(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    return document.querySelector(`[data-id="${elementId}"]`);
  }, [elementId]);

  const handleClick = useCallback(() => {
    elementDOM?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [elementDOM]);

  const handleMouseEnter = useCallback(() => {
    elementDOM?.classList.add('devtools-element-hovered');
  }, [elementDOM]);

  const handleMouseLeave = useCallback(() => {
    elementDOM?.classList.remove('devtools-element-hovered');
  }, [elementDOM]);

  return (
    <div className="flex gap-4 justify-around">
      <div className="flex flex-col grow basis-0 gap-2 min-w-0">
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
      <div className="flex flex-col grow basis-0 gap-2 min-w-0">
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
            <span className="truncate">{triggerName}</span>
          </div>
          <div className="flex gap-1">
            <span>Element:</span>
            <span
              className="truncate text-blue-500 cursor-pointer"
              onClick={handleClick}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {element?.definition.label} [{elementId}]
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BodyHeader;
