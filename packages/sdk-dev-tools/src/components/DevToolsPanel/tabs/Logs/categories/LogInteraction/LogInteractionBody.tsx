import { emptyObject } from '@plitzi/sdk-shared/utils';

import BodyContent from './BodyContent';
import BodyHeader from './BodyHeader';

import type { LogInteraction } from '../../../../../../DevToolsContext';

export type LogInteractionBodyProps = {
  className?: string;
  node: LogInteraction['params']['node'];
  nodes: LogInteraction['params']['nodes'];
  startTime: number;
  endTime: number;
  duration?: string;
  elementId?: string;
};

const LogInteractionBody = ({
  node,
  nodes = emptyObject,
  startTime,
  endTime,
  duration,
  elementId
}: LogInteractionBodyProps) => {
  return (
    <div className="flex flex-col m-2 gap-4">
      <BodyHeader
        triggerName={node.title}
        startTime={startTime}
        endTime={endTime}
        duration={duration}
        elementId={elementId}
      />
      <div className="border-t border-gray-300" />
      <BodyContent node={node} nodes={nodes} className="gap-4" />
    </div>
  );
};

export default LogInteractionBody;
