import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';
import moment from 'moment';
import { useMemo } from 'react';

import LogInteractionBody from './LogInteractionBody';
import LogInteractionHeader from './LogInteractionHeader';

import type { LogInteraction } from '../../../../../../DevToolsContext';
import type { ReactNode } from 'react';

export const LOG_INTERACTION_STATUS_SUCCESS = 'success';
export const LOG_INTERACTION_STATUS_FAILED = 'failed';
export const LOG_INTERACTION_STATUS_SKIPPED = 'skipped';

const iconCollapsed = <i className="fa-solid fa-angle-right" />;
const iconExpanded = <i className="fa-solid fa-angle-down" />;

export type LogInteractionProps = {
  className?: string;
  message?: ReactNode;
  params: LogInteraction['params'];
  time?: string;
};

const LogInteraction = ({
  time,
  message,
  params: { elementId, status, node, nodes, startTime = 0, endTime = 0 }
}: LogInteractionProps) => {
  const duration = useMemo(
    () => `${moment.duration(moment(endTime).diff(startTime)).asMilliseconds()}ms`,
    [startTime, endTime]
  );

  return (
    <ContainerCollapsable className="w-full border-b last:border-b-none border-gray-300 px-2 py-1" collapsed>
      <ContainerCollapsable.Header
        title="Test"
        placement="left"
        className={{ header: 'flex items-center justify-center mr-1 w-4 h-4', headerTitle: 'overflow-hidden' }}
        iconCollapsed={iconCollapsed}
        iconExpanded={iconExpanded}
      >
        <LogInteractionHeader status={status} message={message} nodes={nodes} time={time} duration={duration} />
      </ContainerCollapsable.Header>
      <ContainerCollapsable.Content className="bg-gray-500">
        <LogInteractionBody
          elementId={elementId}
          node={node}
          nodes={nodes}
          startTime={startTime}
          endTime={endTime}
          duration={duration}
        />
      </ContainerCollapsable.Content>
    </ContainerCollapsable>
  );
};

export default LogInteraction;
