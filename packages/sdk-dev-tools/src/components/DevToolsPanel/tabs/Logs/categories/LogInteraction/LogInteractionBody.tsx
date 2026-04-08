import clsx from 'clsx';

import BodyContent from './BodyContent';
import BodyHeader from './BodyHeader';
import { useDevToolsTheme } from '../../../../../../DevToolsThemeContext';

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
  const { isDark } = useDevToolsTheme();

  return (
    <div
      className={clsx(
        'mx-2 my-1.5 flex flex-col gap-2 overflow-hidden rounded border text-xs',
        isDark ? 'border-zinc-800' : 'border-zinc-200'
      )}
    >
      {/* Header: times + details */}
      <div className={clsx('px-3 py-2', isDark ? 'bg-zinc-800/60' : 'bg-zinc-50')}>
        <BodyHeader
          triggerName={node.title}
          startTime={startTime}
          endTime={endTime}
          duration={duration}
          elementId={elementId}
        />
      </div>

      {/* Tree + node detail */}
      <div className={clsx('border-t', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
        <BodyContent node={node} nodes={nodes} className="gap-0" />
      </div>
    </div>
  );
};

export default LogInteractionBody;
