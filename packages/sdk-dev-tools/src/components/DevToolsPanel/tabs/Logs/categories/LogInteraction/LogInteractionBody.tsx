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

const LogInteractionBody = ({ node, nodes, startTime, endTime, duration, elementId }: LogInteractionBodyProps) => {
  return (
    <div className="m-2 flex flex-col text-sm">
      <BodyHeader
        triggerName={node.title}
        startTime={startTime}
        endTime={endTime}
        duration={duration}
        elementId={elementId}
      />
      <div className="border-t border-gray-200" />
      <BodyContent node={node} nodes={nodes} className="gap-2" />
    </div>
  );
};

export default LogInteractionBody;
