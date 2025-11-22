import classNames from 'classnames';
import get from 'lodash-es/get.js';
import { useCallback, useMemo, useState } from 'react';

import ExecutionTree from './ExecutionTree';
import InteractionNode from './InteractionNode';

import type { LogInteraction } from '../../../../../../DevToolsContext';

export type BodyContentProps = {
  className?: string;
  node: LogInteraction['params']['node'];
  nodes: LogInteraction['params']['nodes'];
};

const BodyContent = ({ className, node, nodes }: BodyContentProps) => {
  const [nodeSelectedId, setSelectedNodeId] = useState<string | undefined>(node.id);
  const nodeSelected = useMemo(() => get(nodes, `${nodeSelectedId}`), [nodeSelectedId, nodes]);

  const handleSelect = useCallback((id?: string) => setSelectedNodeId(id), []);

  return (
    <div className={classNames('flex', className)}>
      <ExecutionTree
        className="grow basis-0"
        nodeId={node.id}
        nodes={nodes}
        selected={nodeSelectedId}
        onSelect={handleSelect}
      />
      <div className="border-r border-gray-300" />
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
