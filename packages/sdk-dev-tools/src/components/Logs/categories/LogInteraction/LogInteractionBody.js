/* eslint-disable react/no-danger */
// Packages
import React, { useCallback, useMemo, useState } from 'react';
import get from 'lodash/get';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import BodyHeader from './BodyHeader';
import ExecutionTree from './ExecutionTree';
import InteractionNode from './InteractionNode';

/**
 * @param {{
 *   className?: string;
 *   node?: object;
 *   nodes?: object;
 *   startTime: string;
 *   endTime: string;
 *   duration?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const LogInteractionBody = props => {
  const { node, nodes = emptyObject, startTime, endTime, duration } = props;
  const [nodeSelectedId, setSelectedNodeId] = useState(node.id);
  const nodeSelected = useMemo(() => get(nodes, `${nodeSelectedId}`), [nodeSelectedId]);

  const handleSelect = useCallback(id => setSelectedNodeId(id), []);

  return (
    <div className="flex flex-col m-2 gap-4">
      <BodyHeader triggerName={node.title} startTime={startTime} endTime={endTime} duration={duration} />
      <div className="border-t border-gray-300" />
      <div className="flex gap-4">
        <ExecutionTree
          className="grow basis-0"
          nodeId={node.id}
          nodes={nodes}
          selected={nodeSelectedId}
          onSelect={handleSelect}
        />
        <div className="border-r border-gray-300" />
        {nodeSelectedId && (
          <div className="flex grow basis-0">
            <InteractionNode
              status={nodeSelected.status}
              name={nodeSelected.node.title}
              startTime={nodeSelected.startTime}
              endTime={nodeSelected.endTime}
              when={nodeSelected.node.when}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default LogInteractionBody;
