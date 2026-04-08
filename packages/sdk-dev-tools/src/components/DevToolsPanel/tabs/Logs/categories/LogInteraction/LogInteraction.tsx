import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';
import clsx from 'clsx';
import { useMemo } from 'react';

import { getDurationMs } from '@plitzi/sdk-shared';

import LogInteractionBody from './LogInteractionBody';
import LogInteractionHeader from './LogInteractionHeader';
import { useDevToolsTheme } from '../../../../../../DevToolsThemeContext';
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
  const { isDark } = useDevToolsTheme();
  const duration = useMemo(() => `${getDurationMs(startTime, endTime)}ms`, [startTime, endTime]);
  const nodesSkipped = Object.values(nodes).filter(node => node.status === 'skipped').length;
  const nodesDisabled = Object.values(nodes).filter(node => node.status === 'disabled').length;

  const borderColor = status === 'completed' ? 'border-l-emerald-500' : 'border-l-red-500';

  return (
    <ContainerCollapsable
      className={clsx(
        'last:border-b-none w-full border-b border-l-2 px-2 py-1 transition-colors',
        borderColor,
        isDark ? 'border-b-zinc-700 hover:bg-zinc-800/50' : 'border-b-zinc-200 hover:bg-zinc-50'
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
        <div className={clsx('flex gap-3', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
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
