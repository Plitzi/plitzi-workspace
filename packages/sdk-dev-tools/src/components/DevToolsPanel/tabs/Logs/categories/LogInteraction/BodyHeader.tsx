import get from 'lodash-es/get.js';
import moment from 'moment';
import { use, useCallback, useMemo } from 'react';

import SchemaContext from '@plitzi/sdk-schema/SchemaContext';

import type { Element } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type BodyHeaderProps = {
  className?: string;
  triggerName: ReactNode;
  startTime: number;
  endTime: number;
  duration?: string;
  elementId?: string;
};

const BodyHeader = ({ triggerName, startTime, endTime, duration, elementId }: BodyHeaderProps) => {
  const { schema } = use(SchemaContext);
  const element = useMemo(() => get(schema, `flat.${elementId}`), [schema, elementId]);
  const startTimeParsed = useMemo(() => moment(startTime).format('HH:mm:ss.SSS'), [startTime]);
  const endTimeParsed = useMemo(() => moment(endTime).format('HH:mm:ss.SSS'), [endTime]);
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
    <div className="flex justify-around gap-4">
      <div className="flex min-w-0 grow basis-0 flex-col gap-2">
        <div className="flex items-center gap-1 font-bold">
          <i className="fa-regular fa-clock" />
          Times
        </div>
        <div className="flex flex-col">
          <div className="flex gap-1">
            <span>Started:</span>
            {startTimeParsed}
          </div>
          <div className="flex gap-1">
            <span>End:</span>
            {endTimeParsed}
          </div>
          <div className="flex gap-1">
            <span>Duration:</span>
            {duration}
          </div>
        </div>
      </div>
      <div className="border-r border-gray-300" />
      <div className="flex min-w-0 grow basis-0 flex-col gap-2">
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
              className="cursor-pointer truncate text-blue-500"
              onClick={handleClick}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {(element as Element | undefined)?.definition.label} [{elementId}]
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BodyHeader;
