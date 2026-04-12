import BodyContent from './BodyContent';
import BodyHeader from './BodyHeader';

import type { LogInteraction } from '@plitzi/sdk-shared';

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
    <div className="mx-2 my-1.5 flex flex-col gap-2 overflow-hidden rounded border border-zinc-200 text-xs dark:border-zinc-800">
      {/* Header: times + details */}
      <div className="bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
        <BodyHeader
          triggerName={node.title}
          startTime={startTime}
          endTime={endTime}
          duration={duration}
          elementId={elementId}
        />
      </div>

      {/* Tree + node detail */}
      <div className="border-t border-zinc-200 dark:border-zinc-800">
        <BodyContent node={node} nodes={nodes} className="gap-0" />
      </div>
    </div>
  );
};

export default LogInteractionBody;
