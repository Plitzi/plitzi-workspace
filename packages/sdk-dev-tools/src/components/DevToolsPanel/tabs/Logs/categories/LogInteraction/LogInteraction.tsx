import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';
import { useMemo } from 'react';

import { getDurationMs } from '@plitzi/sdk-shared';

import LogInteractionBody from './LogInteractionBody';
import LogInteractionHeader from './LogInteractionHeader';
import { LOG_TYPE_CUSTOM, LOG_TYPE_WARNING } from '../../../../../../utils/PlitziConsole';
import LogStatusIcon from '../../LogStatusIcon';

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
  const duration = useMemo(() => `${getDurationMs(startTime, endTime)}ms`, [startTime, endTime]);
  const nodesSkipped = Object.values(nodes).filter(node => node.status === 'skipped').length;
  const nodesDisabled = Object.values(nodes).filter(node => node.status === 'disabled').length;

  return (
    <ContainerCollapsable className="last:border-b-none w-full border-b border-gray-300 px-2 py-1" collapsed>
      <ContainerCollapsable.Header
        title={<LogInteractionHeader status={status} message={message} time={time} />}
        placement="left"
        className={{ headerTitle: 'overflow-hidden' }}
        iconCollapsed={iconCollapsed}
        iconExpanded={iconExpanded}
      >
        <div className="flex gap-3">
          {status === 'completed' && !!nodesSkipped && (
            <LogStatusIcon logType={LOG_TYPE_WARNING} title="Skipped">
              {nodesSkipped}
            </LogStatusIcon>
          )}
          {status === 'completed' && !!nodesDisabled && (
            <LogStatusIcon logType={LOG_TYPE_CUSTOM} iconClassName="fa-solid fa-ban" title="Disabled">
              {nodesDisabled}
            </LogStatusIcon>
          )}
          {duration}
        </div>
      </ContainerCollapsable.Header>
      <ContainerCollapsable.Content>
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
