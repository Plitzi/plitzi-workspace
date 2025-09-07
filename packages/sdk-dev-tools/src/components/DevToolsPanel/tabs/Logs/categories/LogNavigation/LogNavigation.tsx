import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';

import LogNavigationBody from './LogNavigationBody';
import LogNavigationHeader from './LogNavigationHeader';

import type { LogNavigation as TLogNavigation } from '../../../../../../DevToolsContext';
import type { Moment } from 'moment';
import type { ReactNode } from 'react';

const iconCollapsed = <i className="fa-solid fa-angle-right" />;
const iconExpanded = <i className="fa-solid fa-angle-down" />;

export type LogNavigationProps = {
  className?: string;
  message?: ReactNode;
  params?: TLogNavigation['params'];
  time?: string | Moment;
};

const LogNavigation = ({ time, message, params }: LogNavigationProps) => (
  <ContainerCollapsable className="w-full border-b last:border-b-none border-gray-300 px-2 py-1" collapsed>
    <ContainerCollapsable.Header
      title={<LogNavigationHeader status={params?.status} message={message} time={time} />}
      placement="left"
      className={{ headerTitle: 'overflow-hidden' }}
      iconCollapsed={iconCollapsed}
      iconExpanded={iconExpanded}
    />
    <ContainerCollapsable.Content>
      <LogNavigationBody elementId={params?.elementId} startTime={time} endTime={time} duration="0ms" />
    </ContainerCollapsable.Content>
  </ContainerCollapsable>
);

export default LogNavigation;
