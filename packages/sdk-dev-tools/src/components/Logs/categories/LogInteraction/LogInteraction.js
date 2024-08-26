// Packages
import React, { useMemo } from 'react';
import moment from 'moment';
import ContainerCollapsable from '@plitzi/plitzi-ui-components/ContainerCollapsable';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import LogInteractionHeader from './LogInteractionHeader';
import LogInteractionBody from './LogInteractionBody';

export const LOG_INTERACTION_STATUS_SUCCESS = 'success';
export const LOG_INTERACTION_STATUS_FAILED = 'failed';
export const LOG_INTERACTION_STATUS_SKIPPED = 'skipped';

const iconCollapsed = <i className="fa-solid fa-angle-right" />;
const iconExpanded = <i className="fa-solid fa-angle-down" />;

/**
 * @param {{
 *   className?: string;
 *   message?: string;
 *   params: object;
 *   time: string;
 * }} props
 * @returns {React.ReactElement}
 */
const LogInteraction = props => {
  const {
    time,
    message,
    params: { status, node = emptyObject, nodes = emptyObject, startTime = 0, endTime = 0 } = emptyObject
  } = props;

  const duration = useMemo(
    () => `${moment.duration(moment(endTime).diff(startTime)).asSeconds()}s`,
    [startTime, endTime]
  );

  // console.log(params?.node?.when);

  return (
    <ContainerCollapsable
      className="w-full border-b last:border-b-none border-gray-300 px-2 py-1"
      iconPlacement="left"
      iconClassName="flex items-center justify-center mr-1 w-4 h-4"
      iconCollapsed={iconCollapsed}
      iconExpanded={iconExpanded}
      title={<LogInteractionHeader status={status} message={message} nodes={nodes} time={time} duration={duration} />}
      collapsed
    >
      <LogInteractionBody node={node} startTime={startTime} endTime={endTime} duration={duration} />
    </ContainerCollapsable>
  );
};

export default LogInteraction;
