/* eslint-disable react/no-danger */
// Packages
import React, { useCallback, useMemo, useState } from 'react';

// Monorepo
import syntaxHighlight from '@plitzi/sdk-shared/syntaxHighlight';
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import BodyHeader from './BodyHeader';
import ExecutionTree from './ExecutionTree';

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
  const content = useMemo(() => syntaxHighlight(JSON.stringify(node, null, 2)), [node]);
  const [nodeSelected, setSelectedNode] = useState(node.id);

  const handleSelect = useCallback(id => setSelectedNode(id), []);

  return (
    <div className="flex flex-col m-4 gap-4">
      <BodyHeader triggerName={node.title} startTime={startTime} endTime={endTime} duration={duration} />
      <div className="flex">
        <ExecutionTree
          className="grow"
          nodeId={node.id}
          nodes={nodes}
          selected={nodeSelected}
          onSelect={handleSelect}
        />
        <div className="flex grow whitespace-pre text-xs">
          <pre dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      </div>
    </div>
  );
};

export default LogInteractionBody;
