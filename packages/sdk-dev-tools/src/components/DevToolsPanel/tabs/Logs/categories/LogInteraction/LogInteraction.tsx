import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';
import clsx from 'clsx';
import { useMemo } from 'react';

import { getDurationMs } from '@plitzi/sdk-shared/dates';
import { isInteractionFlow } from '@plitzi/sdk-shared/devTools';

import LogInteractionBody from './LogInteractionBody';
import LogInteractionHeader from './LogInteractionHeader';
import LogInteractionNote from './LogInteractionNote';
import LogStatusIcon from '../../LogStatusIcon';

import type { InteractionFlowParams, LogInteraction as TLogInteraction } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

const iconCollapsed = <i className="fa-solid fa-angle-right text-[10px]" />;
const iconExpanded = <i className="fa-solid fa-angle-down text-[10px]" />;

export type LogInteractionFlowProps = {
  message?: ReactNode;
  params: InteractionFlowParams;
  time?: string;
};

export type LogInteractionProps = {
  className?: string;
  message?: ReactNode;
  params: TLogInteraction['params'];
  time?: string;
};

/**
 * One finished flow, with every step it took.
 *
 * Split from `LogInteraction` so the hooks below run only for an entry that actually is one — a component that
 * called them and then returned early for a note would break the rules of hooks the first time the two kinds of
 * entry alternated in the list.
 */
const LogInteractionFlow = ({
  time,
  message,
  params: { elementId, hostElementId, status, node, nodes, startTime = 0, endTime = 0 }
}: LogInteractionFlowProps) => {
  const duration = useMemo(() => `${getDurationMs(startTime, endTime)}ms`, [startTime, endTime]);
  const counts = useMemo(() => {
    const statuses = Object.values(nodes).map(({ status: nodeStatus }) => nodeStatus);

    return {
      failed: statuses.filter(nodeStatus => nodeStatus === 'failed').length,
      skipped: statuses.filter(nodeStatus => nodeStatus === 'skipped').length,
      disabled: statuses.filter(nodeStatus => nodeStatus === 'disabled').length
    };
  }, [nodes]);
  const { failed: nodesFailed, skipped: nodesSkipped, disabled: nodesDisabled } = counts;

  return (
    <ContainerCollapsable
      className={clsx(
        'last:border-b-none border-b-ui-line hover:bg-ui-hover w-full border-b border-l-2 px-2 py-1 transition-colors',
        {
          'border-l-emerald-500': status === 'completed',
          'border-l-red-500': status === 'failed',
          'border-l-ui-line-strong': status === 'skipped'
        }
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
        <div className="text-ui-fg-subtle flex gap-3">
          {!!nodesFailed && (
            <LogStatusIcon logType="danger" title="Failed">
              {nodesFailed}
            </LogStatusIcon>
          )}
          {status !== 'skipped' && !!nodesSkipped && (
            <LogStatusIcon logType="warning" title="Skipped">
              {nodesSkipped}
            </LogStatusIcon>
          )}
          {status !== 'skipped' && !!nodesDisabled && (
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
          hostElementId={hostElementId}
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

const LogInteraction = ({ time, message, params }: LogInteractionProps) => {
  if (!isInteractionFlow(params)) {
    return <LogInteractionNote time={time} message={message} params={params} />;
  }

  return <LogInteractionFlow time={time} message={message} params={params} />;
};

export default LogInteraction;
