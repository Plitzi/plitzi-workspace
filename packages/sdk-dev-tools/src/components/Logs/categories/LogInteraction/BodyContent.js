// Packages
import React, { useCallback, useMemo, useState } from 'react';
import get from 'lodash/get';
import classNames from 'classnames';

// Relatives
import ExecutionTree from './ExecutionTree';
import InteractionNode from './InteractionNode';

/**
 * @param {{
 *   className?: string;
 *   node?: object;
 *   nodes?: object;
 * }} props
 * @returns {React.ReactElement}
 */
const BodyContent = props => {
  const { className, node, nodes } = props;
  const [nodeSelectedId, setSelectedNodeId] = useState(node.id);
  const nodeSelected = useMemo(() => get(nodes, `${nodeSelectedId}`), [nodeSelectedId]);

  const handleSelect = useCallback(id => setSelectedNodeId(id), []);

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
        <div className="flex grow basis-0 min-w-0">
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
