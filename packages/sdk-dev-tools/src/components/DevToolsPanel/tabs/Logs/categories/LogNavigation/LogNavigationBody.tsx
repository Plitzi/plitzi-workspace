import { get } from '@plitzi/plitzi-ui/helpers';
import { use, useMemo } from 'react';

import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import { formatDate } from '@plitzi/sdk-shared';

import type { Element } from '@plitzi/sdk-shared';

export type LogNavigationBodyProps = {
  className?: string;
  startTime?: string | Date;
  endTime?: string | Date;
  duration?: string;
  elementId?: string;
};

const LogNavigationBody = ({ elementId, startTime, endTime, duration }: LogNavigationBodyProps) => {
  const { schema } = use(SchemaContext);
  const element = useMemo(() => get(schema, `flat.${elementId}`), [schema, elementId]);

  return (
    <div className="m-2 flex justify-around gap-4">
      <div className="flex min-w-0 grow basis-0 flex-col gap-2">
        <div className="flex items-center gap-1 font-bold">
          <i className="fa-regular fa-clock" />
          Times
        </div>
        <div className="flex flex-col">
          <div className="flex gap-1">
            <span>Started:</span>
            {typeof startTime === 'string' ? startTime : formatDate(startTime)}
          </div>
          <div className="flex gap-1">
            <span>End:</span>
            {typeof endTime === 'string' ? endTime : formatDate(endTime)}
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
            <span>Navigation</span>
          </div>
          <div className="flex gap-1">
            <span>Trigger:</span>
            <span className="truncate">-</span>
          </div>
          {(element as Element | undefined) && (
            <div className="flex gap-1">
              <span>Element:</span>
              <span className="cursor-pointer truncate text-blue-500">
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
