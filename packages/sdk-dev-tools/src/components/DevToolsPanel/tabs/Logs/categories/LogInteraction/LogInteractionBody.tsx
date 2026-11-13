import BodyContent from './BodyContent';
import BodyHeader from './BodyHeader';

import type { InteractionFlowParams } from '@plitzi/sdk-shared';

export type LogInteractionBodyProps = {
  className?: string;
  node: InteractionFlowParams['node'];
  nodes: InteractionFlowParams['nodes'];
  startTime: number;
  endTime: number;
  duration?: string;
  elementId?: string;
  hostElementId?: string;
};

const LogInteractionBody = ({
  node,
  nodes,
  startTime,
  endTime,
  duration,
  elementId,
  hostElementId
}: LogInteractionBodyProps) => {
  return (
    <div className="border-ui-line mx-2 my-1.5 flex flex-col gap-2 overflow-hidden rounded border text-xs">
      <div className="bg-ui-raised px-3 py-2">
        <BodyHeader
          triggerName={node.title}
          startTime={startTime}
          endTime={endTime}
          duration={duration}
          elementId={elementId}
          hostElementId={hostElementId}
        />
      </div>

      <div className="border-ui-line border-t">
        <BodyContent node={node} nodes={nodes} className="gap-0" />
      </div>
    </div>
  );
};

export default LogInteractionBody;
