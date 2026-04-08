import { get } from '@plitzi/plitzi-ui/helpers';
import clsx from 'clsx';
import { useCallback, useMemo, useState } from 'react';

import ExecutionTree from './ExecutionTree';
import InteractionNode from './InteractionNode';
import { useDevToolsTheme } from '../../../../../../DevToolsThemeContext';

import type { LogInteraction } from '@plitzi/sdk-shared';

export type BodyContentProps = {
  className?: string;
  node: LogInteraction['params']['node'];
  nodes: LogInteraction['params']['nodes'];
};

const BodyContent = ({ className, node, nodes }: BodyContentProps) => {
  const { isDark } = useDevToolsTheme();
  const [nodeSelectedId, setSelectedNodeId] = useState<string | undefined>(node.id);
  const nodeSelected = useMemo(() => get(nodes, `${nodeSelectedId}`), [nodeSelectedId, nodes]);

  const handleSelect = useCallback((id?: string) => setSelectedNodeId(id), []);

  return (
    <div className={clsx('flex', className)}>
      <ExecutionTree
        className="grow basis-0"
        nodeId={node.id}
        nodes={nodes}
        selected={nodeSelectedId}
        onSelect={handleSelect}
      />
      <div className={clsx('mx-1 w-px shrink-0', isDark ? 'bg-zinc-800' : 'bg-zinc-200')} />
      {nodeSelectedId && (
        <div className="flex min-w-0 grow basis-0">
          <InteractionNode
            whenParams={nodeSelected.whenParams}
            status={nodeSelected.status}
            name={nodeSelected.node.title}
            startTime={nodeSelected.startTime}
            endTime={nodeSelected.endTime}
            when={nodeSelected.node.when}
            type={nodeSelected.node.type}
            action={nodeSelected.node.action}
          />
        </div>
      )}
    </div>
  );
};

export default BodyContent;
