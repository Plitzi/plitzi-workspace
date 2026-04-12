import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';
import clsx from 'clsx';
import { useMemo } from 'react';

import { getDurationMs } from '@plitzi/sdk-shared';

import LogInteractionBody from './LogInteractionBody';
import LogInteractionHeader from './LogInteractionHeader';
import LogStatusIcon from '../../LogStatusIcon';

import type { LogInteraction as TLogInteraction } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

const iconCollapsed = <i className="fa-solid fa-angle-right text-[10px]" />;
const iconExpanded = <i className="fa-solid fa-angle-down text-[10px]" />;

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
    <ContainerCollapsable
      className={clsx(
        'last:border-b-none w-full border-b border-l-2 border-b-zinc-200 px-2 py-1 transition-colors hover:bg-zinc-50 dark:border-b-zinc-700 dark:hover:bg-zinc-800/50',
        { 'border-l-emerald-500': status === 'completed', 'border-l-red-500': status === 'skipped' }
      )}
      collapsed
    >
      <ContainerCollapsable.Header
        title={<LogInteractionHeader status={status} message={message} time={time} />}
        placement="left"
        className={{ headerTitle: 'overflow-hidden' }}
        iconCollapsed={iconCollapsed}
        iconExpanded={iconExpanded}
      >
        <div className="flex gap-3 text-zinc-400 dark:text-zinc-500">
          {status === 'completed' && !!nodesSkipped && (
            <LogStatusIcon logType="warning" title="Skipped">
              {nodesSkipped}
            </LogStatusIcon>
          )}
          {status === 'completed' && !!nodesDisabled && (
            <LogStatusIcon logType="custom" iconClassName="fa-solid fa-ban" title="Disabled">
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
