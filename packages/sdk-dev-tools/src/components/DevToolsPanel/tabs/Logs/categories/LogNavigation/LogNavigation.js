// Packages
import React from 'react';
import ContainerCollapsable from '@plitzi/plitzi-ui-components/ContainerCollapsable/index.js';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import LogNavigationHeader from './LogNavigationHeader.js';
import LogNavigationBody from './LogNavigationBody.js';

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
const LogNavigation = props => {
  const { time, message, params: { elementId, status } = emptyObject } = props;

  return (
    <ContainerCollapsable
      className="w-full border-b last:border-b-none border-gray-300 px-2 py-1"
      iconPlacement="left"
      iconClassName="flex items-center justify-center mr-1 w-4 h-4"
      titleClassName="overflow-hidden"
      iconCollapsed={iconCollapsed}
      iconExpanded={iconExpanded}
      title={<LogNavigationHeader status={status} message={message} time={time} />}
      collapsed
    >
      <LogNavigationBody elementId={elementId} startTime={time} endTime={time} duration="0ms" />
    </ContainerCollapsable>
  );
};

export default LogNavigation;
