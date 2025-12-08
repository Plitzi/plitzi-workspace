import { Icon } from '@plitzi/plitzi-ui/components';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow } from '@xyflow/react';
import { useCallback } from 'react';

import type { EdgeProps } from '@xyflow/react';

const CustomEdge = ({ id, sourceX, sourceY, targetX, targetY, selected = false, ...props }: EdgeProps) => {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY });

  const handleClick = useCallback(() => setEdges(es => es.filter(e => e.id !== id)), [id, setEdges]);

  return (
    <>
      <BaseEdge id={id} path={edgePath} {...props} />
      {selected && (
        <EdgeLabelRenderer>
          <button
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all'
            }}
            className="nodrag nopan flex h-5 w-5 cursor-pointer items-center justify-center gap-1 rounded-full bg-red-100"
            onClick={handleClick}
            title="Remove"
          >
            <Icon icon="fas fa-xmark" intent="danger" size="sm" />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default CustomEdge;
