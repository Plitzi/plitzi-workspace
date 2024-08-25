/* eslint-disable react/no-danger */
// Packages
import React, { useMemo } from 'react';
import moment from 'moment';
import ContainerCollapsable from '@plitzi/plitzi-ui-components/ContainerCollapsable';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';
import syntaxHighlight from '@plitzi/sdk-shared/syntaxHighlight';

// Relatives
import LogStatus from '../LogStatus';

const iconCollapsed = <i className="fa-solid fa-angle-right" />;
const iconExpanded = <i className="fa-solid fa-angle-down" />;

/**
 * @param {{
 *   className?: string;
 *   message?: string;
 *   params: object;
 *   time: string;
 *   logType: string;
 * }} props
 * @returns {React.ReactElement}
 */
const LogInteraction = props => {
  const { time, message, params: { node = emptyObject, startTime = 0, endTime = 0 } = emptyObject, logType } = props;

  const content = useMemo(() => syntaxHighlight(JSON.stringify(node, null, 2)), [node]);
  const duration = useMemo(
    () => `${moment.duration(moment(endTime).diff(startTime)).asSeconds()}s`,
    [startTime, endTime]
  );
  const title = useMemo(
    () => (
      <div className="flex justify-between w-full">
        <div className="flex items-center gap-2">
          <span className="font-bold">{time}</span>
          <LogStatus logType={logType} />
          {message}
        </div>
        {duration}
      </div>
    ),
    [duration, message, logType, time]
  );

  // console.log(params?.node?.when);

  return (
    <ContainerCollapsable
      className="w-full border-b last:border-b-none border-gray-300 px-2 py-1"
      iconPlacement="left"
      iconClassName="flex items-center justify-center mr-1 w-4 h-4"
      iconCollapsed={iconCollapsed}
      iconExpanded={iconExpanded}
      title={title}
      collapsed
    >
      <div>
        <div className="flex whitespace-pre">
          <pre dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      </div>
    </ContainerCollapsable>
  );
};

export default LogInteraction;
