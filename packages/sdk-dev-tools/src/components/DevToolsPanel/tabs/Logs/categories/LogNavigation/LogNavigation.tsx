// Packages
import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';

// Relatives
import LogNavigationBody from './LogNavigationBody';
import LogNavigationHeader from './LogNavigationHeader';

// Types
import type { LogNavigation } from '../../../../../../DevToolsContext';
import type { Moment } from 'moment';
import type { ReactNode } from 'react';

const iconCollapsed = <i className="fa-solid fa-angle-right" />;
const iconExpanded = <i className="fa-solid fa-angle-down" />;

export type LogNavigationProps = {
  className?: string;
  message?: ReactNode;
  params?: LogNavigation['params'];
  time?: string | Moment;
};

const LogNavigation = ({ time, message, params }: LogNavigationProps) => (
  <ContainerCollapsable className="w-full border-b last:border-b-none border-gray-300 px-2 py-1" collapsed>
    <ContainerCollapsable.Header
      title="Test"
      placement="left"
      className={{ header: 'flex items-center justify-center mr-1 w-4 h-4', headerTitle: 'overflow-hidden' }}
      iconCollapsed={iconCollapsed}
      iconExpanded={iconExpanded}
    >
      <LogNavigationHeader status={params?.status} message={message} time={time} />
    </ContainerCollapsable.Header>
    <ContainerCollapsable.Content className="bg-gray-500">
      <LogNavigationBody elementId={params?.elementId} startTime={time} endTime={time} duration="0ms" />
    </ContainerCollapsable.Content>
  </ContainerCollapsable>
);

export default LogNavigation;
