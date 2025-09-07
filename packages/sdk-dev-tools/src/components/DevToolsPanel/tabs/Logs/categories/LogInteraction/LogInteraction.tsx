import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';
import moment from 'moment';
import { useMemo } from 'react';

import LogInteractionBody from './LogInteractionBody';
import LogInteractionHeader from './LogInteractionHeader';

import type { LogInteraction as TLogInteraction } from '../../../../../../DevToolsContext';
import type { ReactNode } from 'react';

const iconCollapsed = <i className="fa-solid fa-angle-right" />;
const iconExpanded = <i className="fa-solid fa-angle-down" />;

export type LogInteractionProps = {
  className?: string;
  message?: ReactNode;
  params: TLogInteraction['params'];
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
    <ContainerCollapsable className="last:border-b-none w-full border-b border-gray-300 px-2 py-1" collapsed>
      <ContainerCollapsable.Header
        title="Test"
        placement="left"
        className={{ header: 'mr-1 flex h-4 w-4 items-center justify-center', headerTitle: 'overflow-hidden' }}
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
