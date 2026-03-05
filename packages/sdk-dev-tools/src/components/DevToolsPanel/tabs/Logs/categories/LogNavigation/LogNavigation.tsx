import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';

import LogNavigationBody from './LogNavigationBody';
import LogNavigationHeader from './LogNavigationHeader';

import type { LogNavigation as TLogNavigation } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

const iconCollapsed = <i className="fa-solid fa-angle-right" />;
const iconExpanded = <i className="fa-solid fa-angle-down" />;

export type LogNavigationProps = {
  className?: string;
  message?: ReactNode;
  params?: TLogNavigation['params'];
  time?: string | Date;
};

const LogNavigation = ({ time, message, params }: LogNavigationProps) => (
  <ContainerCollapsable className="last:border-b-none w-full border-b border-gray-300 px-2 py-1" collapsed>
    <ContainerCollapsable.Header
      title={<LogNavigationHeader status={params?.status} message={message} time={time} />}
      placement="left"
      className={{ headerTitle: 'overflow-hidden' }}
      iconCollapsed={iconCollapsed}
      iconExpanded={iconExpanded}
    >
      0ms
    </ContainerCollapsable.Header>
    <ContainerCollapsable.Content>
      <LogNavigationBody elementId={params?.elementId} startTime={time} endTime={time} duration="0ms" />
    </ContainerCollapsable.Content>
  </ContainerCollapsable>
);

export default LogNavigation;
